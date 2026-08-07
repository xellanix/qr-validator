package migration

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"premark/lib"
	"premark/persist"
	"regexp"
	"runtime"
	"strings"
	"sync"
)

func MigrateUserKey() error {
	fmt.Println("> Migrating user keys...")

	numWorkers := runtime.NumCPU() * 2
	jobs := make(chan string, numWorkers*8)
	var wg sync.WaitGroup

	for range numWorkers {
		wg.Go(func() {
			for path := range jobs {
				data, err := os.ReadFile(path)
				if err != nil {
					continue
				}

				hash, err := lib.CreateSearchHash(data)
				if err != nil {
					continue
				}

				err = os.WriteFile(path, hash, 0644)
				if err != nil {
					continue
				}

				ext := filepath.Ext(path)
				filename := strings.TrimSuffix(filepath.Base(path), ext)

				migratedPath := filepath.Join(filepath.Dir(path), fmt.Sprintf("%s_v2%s", filename, ext))
				os.Rename(path, migratedPath)
			}
		})
	}

	usersPath := persist.PublicDir("output", "users")
	fileRegex, err := regexp.Compile(`^\w+_\d{20}\.key$`)
	if err != nil {
		return fmt.Errorf("Failed to compile regex: %w", err)
	}

	err = filepath.WalkDir(usersPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() && d.Type().IsRegular() && fileRegex.MatchString(filepath.Base(path)) {
			jobs <- path
		}
		return nil
	})

	close(jobs)
	wg.Wait()

	return err
}
