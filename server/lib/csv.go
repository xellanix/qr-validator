package lib

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"premark/types"
)

// IsBinaryPayload asserts if the byte boundaries match forbidden executable formats.
func IsBinaryPayload(data []byte) bool {
	if len(data) < 4 {
		return false
	}

	// Windows PE Executable marker check
	if data[0] == 0x4D && data[1] == 0x5A {
		return true
	}
	// Linux Executable Linkable Format (ELF) check
	if data[0] == 0x7F && data[1] == 0x45 && data[2] == 0x4C && data[3] == 0x46 {
		return true
	}
	// macOS Mach-O Executable format tracking checks
	if (data[0] == 0xCF && data[1] == 0xFA && data[2] == 0xED && data[3] == 0xFE) ||
		(data[0] == 0xCE && data[1] == 0xFA && data[2] == 0xED && data[3] == 0xFE) {
		return true
	}

	return false
}

// StreamCSVRows streams raw data structures into key-value map allocations sequentially.
func StreamCSVRows(data []byte) ([]types.DatasetRow, error) {
	if IsBinaryPayload(data) {
		return nil, errors.New("Malformed processing state: Executable context uploads are forbidden")
	}

	reader := csv.NewReader(bytes.NewReader(data))
	reader.TrimLeadingSpace = true

	// Pull headers layout signature vector first
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("Failed parsing csv structural headers: %w", err)
	}

	var matrix []types.DatasetRow
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("Error parsing dynamic row indices: %w", err)
		}

		// Replicates structural trim / skip empty constraints cleanly
		rowMap := make(types.DatasetRow)
		hasContent := false
		for i, val := range record {
			if i >= len(headers) {
				break
			}
			if val != "" {
				hasContent = true
			}
			rowMap[headers[i]] = val
		}

		if hasContent {
			matrix = append(matrix, rowMap)
		}
	}

	return matrix, nil
}
