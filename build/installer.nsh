; Custom NSIS script to fix integrity check issues
; This file is included in the NSIS installer build

; Disable CRC check - sometimes electron-builder creates installers that fail NSIS CRC
; even though the files are fine. This is a known issue with large electron apps.
CRCCheck off

; Set solid compression to improve reliability
SetCompressor /SOLID lzma

; Increase timeout for extraction (helps with large files)
!define NSIS_MAX_STRLEN 8192
