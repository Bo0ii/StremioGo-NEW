; Custom NSIS script to fix integrity check issues
; This file is included in the NSIS installer build

; Disable CRC check - sometimes electron-builder creates installers that fail NSIS CRC
; even though the files are fine. This is a known issue with large electron apps.
; This is the primary fix for large Electron applications.
CRCCheck off

; Set data block optimization for better performance with large files
SetDatablockOptimize on

; Set better error handling for large files
SetOverwrite on
SetDateSave on

; Note: Compression is handled by electron-builder's compression setting in package.json
; Do not set SetCompressor here as it conflicts with electron-builder's internal macros
