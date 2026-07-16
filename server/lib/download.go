package lib

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// GetFileByDuplicateIndex finds a file matching the name pattern and returns the one at the target index.
func GetFileByDuplicateIndex(dir string, name string, targetIndex int) (string, error) {
	// Sanitize the name to match the generated files
	sanitizedName := strings.ToLower(regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(name, "_"))

	// Build the regex pattern to match the generated files
	// Escaping sanitizedName ensures safety, followed by `_\d+\.key` to match the timemark digits
	fileRegex, err := regexp.Compile(fmt.Sprintf(`^%s_\d{20}\.key$`, regexp.QuoteMeta(sanitizedName)))
	if err != nil {
		return "", fmt.Errorf("Failed to compile regex: %w", err)
	}

	// Read the directory entries
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("Failed to read directory: %w", err)
	}

	// Collect all matching files
	var matchedFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && fileRegex.MatchString(entry.Name()) {
			matchedFiles = append(matchedFiles, entry.Name())
		}
	}

	// If no files match, return an error
	totalMatched := len(matchedFiles)
	if totalMatched == 0 {
		return "", fmt.Errorf("No files matched the pattern for name: %s", name)
	}

	// Sort alphabetically. Since the timemark uses YYYYMMDDHHMMSS,
	// alphabetical order automatically aligns with chronological order.
	sort.Strings(matchedFiles)

	// Validate and return the file at the target duplicate index
	if targetIndex < 0 || targetIndex >= totalMatched {
		return "", fmt.Errorf("Index %d out of bounds; only %d file(s) matched", targetIndex, totalMatched)
	}

	// Returns the full path to the file
	return filepath.Join(dir, matchedFiles[targetIndex]), nil
}
