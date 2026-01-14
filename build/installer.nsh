; Custom NSIS script for maximum LZMA compression
; This enables LZMA solid compression for smaller installer size

; Set compressor to LZMA with solid compression
SetCompressor /SOLID lzma

; Optional: Set dictionary size (default is 8MB, can increase for better compression)
; SetCompressorDictSize 32
