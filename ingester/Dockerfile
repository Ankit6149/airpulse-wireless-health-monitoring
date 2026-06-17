FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy source code
COPY main.go .

# Build statically linked standalone binary
RUN go env -w GO111MODULE=auto
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ingester main.go

FROM alpine:3.19

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/ingester .

# Expose UDP port 8090 for receiving raw CSI packets
EXPOSE 8090/udp

# Start ingester
ENTRYPOINT ["./ingester"]
