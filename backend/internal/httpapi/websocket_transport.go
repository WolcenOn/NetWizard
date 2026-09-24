package httpapi

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/WolcenOn/NetWizard/backend/internal/realtime"
)

const (
	websocketGUID     = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	maxWebSocketFrame = 256 * 1024
)

type wsConn struct {
	id      string
	conn    net.Conn
	rw      *bufio.ReadWriter
	readMu  sync.Mutex
	writeMu sync.Mutex
	closed  sync.Once
}

func (c *wsConn) ID() string { return c.id }

func upgradeWebSocket(w http.ResponseWriter, r *http.Request, clientID string) (*wsConn, error) {
	if !strings.EqualFold(strings.TrimSpace(r.Header.Get("Upgrade")), "websocket") ||
		!headerContainsToken(r.Header.Get("Connection"), "upgrade") ||
		strings.TrimSpace(r.Header.Get("Sec-WebSocket-Version")) != "13" {
		return nil, errors.New("invalid websocket upgrade")
	}
	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	rawKey, err := base64.StdEncoding.DecodeString(key)
	if err != nil || len(rawKey) != 16 {
		return nil, errors.New("invalid websocket key")
	}
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("websocket hijacking unsupported")
	}
	conn, rw, err := hijacker.Hijack()
	if err != nil {
		return nil, err
	}
	sum := sha1.Sum([]byte(key + websocketGUID))
	accept := base64.StdEncoding.EncodeToString(sum[:])
	if _, err := fmt.Fprintf(rw,
		"HTTP/1.1 101 Switching Protocols\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Accept: %s\r\n\r\n", accept); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := rw.Flush(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &wsConn{id: clientID, conn: conn, rw: rw}, nil
}

func headerContainsToken(value, token string) bool {
	for _, part := range strings.Split(value, ",") {
		if strings.EqualFold(strings.TrimSpace(part), token) {
			return true
		}
	}
	return false
}

func (c *wsConn) Send(ctx context.Context, msg realtime.Message) error {
	raw, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return c.writeFrame(ctx, 0x1, raw)
}

func (c *wsConn) Read(ctx context.Context) (realtime.Message, error) {
	c.readMu.Lock()
	defer c.readMu.Unlock()

	for {
		if deadline, ok := ctx.Deadline(); ok {
			_ = c.conn.SetReadDeadline(deadline)
		} else {
			_ = c.conn.SetReadDeadline(time.Time{})
		}
		opcode, payload, err := c.readFrame()
		if err != nil {
			return realtime.Message{}, err
		}
		switch opcode {
		case 0x1:
			var msg realtime.Message
			if err := json.Unmarshal(payload, &msg); err != nil {
				return realtime.Message{}, errors.New("invalid websocket JSON")
			}
			return msg, nil
		case 0x8:
			return realtime.Message{}, io.EOF
		case 0x9:
			_ = c.writeFrame(ctx, 0xA, payload)
		case 0xA:
			continue
		default:
			return realtime.Message{}, errors.New("unsupported websocket opcode")
		}
	}
}

func (c *wsConn) readFrame() (byte, []byte, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(c.rw, header); err != nil {
		return 0, nil, err
	}
	if header[0]&0x70 != 0 || header[0]&0x80 == 0 {
		return 0, nil, errors.New("fragmented or reserved websocket frame")
	}
	opcode := header[0] & 0x0F
	if header[1]&0x80 == 0 {
		return 0, nil, errors.New("client websocket frame must be masked")
	}
	length := uint64(header[1] & 0x7F)
	switch length {
	case 126:
		var ext [2]byte
		if _, err := io.ReadFull(c.rw, ext[:]); err != nil {
			return 0, nil, err
		}
		length = uint64(binary.BigEndian.Uint16(ext[:]))
	case 127:
		var ext [8]byte
		if _, err := io.ReadFull(c.rw, ext[:]); err != nil {
			return 0, nil, err
		}
		length = binary.BigEndian.Uint64(ext[:])
		if length>>63 != 0 {
			return 0, nil, errors.New("invalid websocket frame length")
		}
	}
	if length > maxWebSocketFrame {
		return 0, nil, errors.New("websocket frame too large")
	}
	var mask [4]byte
	if _, err := io.ReadFull(c.rw, mask[:]); err != nil {
		return 0, nil, err
	}
	payload := make([]byte, int(length))
	if _, err := io.ReadFull(c.rw, payload); err != nil {
		return 0, nil, err
	}
	for i := range payload {
		payload[i] ^= mask[i%4]
	}
	return opcode, payload, nil
}

func (c *wsConn) writeFrame(ctx context.Context, opcode byte, payload []byte) error {
	if len(payload) > maxWebSocketFrame {
		return errors.New("websocket payload too large")
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if deadline, ok := ctx.Deadline(); ok {
		_ = c.conn.SetWriteDeadline(deadline)
	} else {
		_ = c.conn.SetWriteDeadline(time.Now().Add(15 * time.Second))
	}

	first := byte(0x80) | opcode
	header := []byte{first}
	length := len(payload)
	switch {
	case length < 126:
		header = append(header, byte(length))
	case length <= 65535:
		header = append(header, 126, byte(length>>8), byte(length))
	default:
		header = append(header, 127,
			byte(uint64(length)>>56), byte(uint64(length)>>48), byte(uint64(length)>>40), byte(uint64(length)>>32),
			byte(uint64(length)>>24), byte(uint64(length)>>16), byte(uint64(length)>>8), byte(uint64(length)))
	}
	if _, err := c.rw.Write(header); err != nil {
		return err
	}
	if _, err := c.rw.Write(payload); err != nil {
		return err
	}
	return c.rw.Flush()
}

func (c *wsConn) Close() error {
	var err error
	c.closed.Do(func() {
		_ = c.writeFrame(context.Background(), 0x8, nil)
		err = c.conn.Close()
	})
	return err
}
