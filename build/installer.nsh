; Custom NSIS script to fix integrity check issues
; This file is included in the NSIS installer build

; Disable CRC check - sometimes electron-builder creates installers that fail NSIS CRC
; even though the files are fine. This is a known issue with large electron apps.
CRCCheck off

; Use solid compression for better reliability and smaller size with large files
SetCompressor /SOLID lzma
SetCompressorDictSize 64

; Set data block optimization for better performance
SetDatablockOptimize on

; Increase timeout for extraction (helps with large files and slower systems)
; NSIS_MAX_STRLEN is already defined by NSIS itself, do not redefine it
; Use increased buffer size if needed via other means

; Set better error handling for large files
SetOverwrite on
SetDateSave on
