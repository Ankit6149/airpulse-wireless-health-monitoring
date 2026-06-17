package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"log"
	"math"
	"net"
	"os"
	"sync"
	"time"
)

// IngestedFrame represents the JSON payload streamed to Python.
type IngestedFrame struct {
	NodeID      string    `json:"node_id"`
	TimestampUs uint64    `json:"timestamp_us"`
	SequenceID  uint32    `json:"sequence_id"`
	Rssi        int8      `json:"rssi"`
	Amplitude   []float64 `json:"amplitude"`
	Phase       []float64 `json:"phase"`
}

// Global pool to recycle frames and avoid garbage collection overhead
var framePool = sync.Pool{
	New: func() interface{} {
		return &IngestedFrame{
			Amplitude: make([]float64, 0, 192),
			Phase:     make([]float64, 0, 192),
		}
	},
}

func main() {
	bindAddr := flag.String("bind", "0.0.0.0:8090", "UDP address to bind for raw CSI packets")
	destVal := "127.0.0.1:8091"
	if envDest := os.Getenv("AIRPULSE_BACKEND_ADDR"); envDest != "" {
		destVal = envDest
	}
	destAddr := flag.String("dest", destVal, "TCP address of Python backend server")
	flag.Parse()

	// 1. Listen on UDP port
	udpAddr, err := net.ResolveUDPAddr("udp", *bindAddr)
	if err != nil {
		log.Fatalf("[Ingester] Failed to resolve UDP address: %v", err)
	}
	udpConn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		log.Fatalf("[Ingester] Failed to listen on UDP socket: %v", err)
	}
	defer udpConn.Close()
	log.Printf("[Ingester] UDP receiver active on %s", *bindAddr)

	// Channel for sanitized frames
	frameChan := make(chan *IngestedFrame, 5000)

	// Run TCP streaming client in background with auto-reconnection
	go tcpStreamingClient(*destAddr, frameChan)

	buffer := make([]byte, 4096)
	for {
		n, remoteAddr, err := udpConn.ReadFromUDP(buffer)
		if err != nil {
			continue
		}
		if n < 15 {
			continue // Invalid packet size
		}

		// Parse Header (15 bytes)
		seqID := binary.BigEndian.Uint32(buffer[0:4])
		timestampUs := binary.BigEndian.Uint64(buffer[4:12])
		rssi := int8(buffer[12])
		numSubcarriers := binary.BigEndian.Uint16(buffer[13:15])

		// Parse alternating I/Q samples (each subcarrier is 4 bytes: 2 bytes I, 2 bytes Q)
		expectedBytes := int(numSubcarriers) * 4
		if n < 15+expectedBytes {
			continue // Truncated packet
		}

		// Resolve node ID from remote address
		nodeID := "unknown"
		if remoteAddr != nil {
			if remoteAddr.IP.IsLoopback() {
				nodeID = remoteAddr.String()
			} else {
				nodeID = remoteAddr.IP.String()
			}
		}

		// Retrieve pre-allocated frame from pool
		frame := framePool.Get().(*IngestedFrame)
		frame.NodeID = nodeID
		frame.TimestampUs = timestampUs
		frame.SequenceID = seqID
		frame.Rssi = rssi

		// Resize slice lengths to match numSubcarriers (avoiding dynamic reallocation if capacity fits)
		if cap(frame.Amplitude) < int(numSubcarriers) {
			frame.Amplitude = make([]float64, numSubcarriers)
		} else {
			frame.Amplitude = frame.Amplitude[:numSubcarriers]
		}
		if cap(frame.Phase) < int(numSubcarriers) {
			frame.Phase = make([]float64, numSubcarriers)
		} else {
			frame.Phase = frame.Phase[:numSubcarriers]
		}

		cursor := 15
		for i := 0; i < int(numSubcarriers); i++ {
			// Extract signed 16-bit integers
			iVal := int16(binary.BigEndian.Uint16(buffer[cursor : cursor+2]))
			qVal := int16(binary.BigEndian.Uint16(buffer[cursor+2 : cursor+4]))
			cursor += 4

			I := float64(iVal)
			Q := float64(qVal)

			frame.Amplitude[i] = math.Sqrt(I*I + Q*Q)
			frame.Phase[i] = math.Atan2(Q, I)
		}

		// Perform zero-mean linear phase sanitization in-place (zero-allocations)
		sanitizePhasesInPlace(frame.Phase)

		// Queue frame non-blockingly
		select {
		case frameChan <- frame:
		default:
			// Buffer full - drop frame to prevent lagging, and return it to pool
			framePool.Put(frame)
		}
	}
}

// sanitizePhasesInPlace removes CFO and SFO offsets from measured phases via linear regression in-place.
func sanitizePhasesInPlace(phases []float64) {
	n := len(phases)
	if n < 2 {
		return
	}

	// 1. Calculate SFO timing slope alpha
	alpha := (phases[n-1] - phases[0]) / float64(n-1)

	// 2. Detrend the linear timing slope in-place and accumulate sum
	sumDetrended := 0.0
	for i := 0; i < n; i++ {
		phases[i] = phases[i] - (alpha * float64(i))
		sumDetrended += phases[i]
	}

	// 3. Calculate CFO mean intercept beta
	beta := sumDetrended / float64(n)

	// 4. Subtract beta intercept
	for i := 0; i < n; i++ {
		phases[i] = phases[i] - beta
	}
}

// tcpStreamingClient handles connecting and writing to the Python TCP server with backoff.
func tcpStreamingClient(destAddr string, frameChan chan *IngestedFrame) {
	for {
		log.Printf("[TCP Sender] Attempting connection to Python server on %s", destAddr)
		conn, err := net.Dial("tcp", destAddr)
		if err != nil {
			log.Printf("[TCP Sender] Dial failed: %v. Retrying in 3 seconds...", err)
			time.Sleep(3 * time.Second)
			continue
		}
		log.Printf("[TCP Sender] Connected to Python server.")

		encoder := json.NewEncoder(conn)
		writeFailed := false

		for frame := range frameChan {
			// Encode frame as single-line JSON, ending with a newline delimiter
			err := encoder.Encode(frame)
			if err != nil {
				log.Printf("[TCP Sender] Write failed: %v", err)
				writeFailed = true
				framePool.Put(frame)
				break
			}
			// Recycle frame back to the pool
			framePool.Put(frame)
		}

		conn.Close()
		if writeFailed {
			time.Sleep(2 * time.Second)
		}
	}
}
