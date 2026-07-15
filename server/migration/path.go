package migration

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"premark/persist"
)

// RenameAndCombine moves oldPath to newPath.
// It skips if oldPath doesn't exist, and merges contents if newPath already exists.
func RenameAndCombine(oldPath, newPath string) error {
	srcStat, err := os.Stat(oldPath)
	if os.IsNotExist(err) {
		// Old path doesn't exist
		return nil
	}
	if err != nil {
		return fmt.Errorf("Failed to stat source: %w", err)
	}
	if !srcStat.IsDir() {
		return errors.New("Source path is a file, not a directory")
	}

	dstStat, err := os.Stat(newPath)
	if os.IsNotExist(err) {
		// Destination doesn't exist at all, we can do a simple, fast rename
		return os.Rename(oldPath, newPath)
	}
	if err != nil {
		return fmt.Errorf("Failed to stat destination: %w", err)
	}
	if !dstStat.IsDir() {
		return errors.New("Destination path exists but is a file, cannot combine")
	}

	// Destination exists: time to recursively merge
	return mergeDirs(oldPath, newPath)
}

// mergeDirs recursively moves contents from src to dst, then deletes src
func mergeDirs(src, dst string) error {
	// Ensure the destination folder exists (with appropriate permissions)
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcItem := filepath.Join(src, entry.Name())
		dstItem := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// If it's a sub-directory, recurse into it
			if err := mergeDirs(srcItem, dstItem); err != nil {
				return err
			}
		} else {
			// If it's a file, move it over (overwriting if necessary).
			if err := os.Rename(srcItem, dstItem); err != nil {
				return err
			}
		}
	}

	// Once all contents are safely moved out, remove the now-empty source directory
	return os.Remove(src)
}

func MigratePath() error {
	fmt.Println("> Migrating paths...")

	pathMap := map[string]string{
		persist.PublicDir("output", "presence_qr"): persist.PublicDir("output", "presence"),
	}

	for oldPath, newPath := range pathMap {
		if err := RenameAndCombine(oldPath, newPath); err != nil {
			return fmt.Errorf("Failed to migrate path %s to %s: %w", oldPath, newPath, err)
		}
	}

	return nil
}
