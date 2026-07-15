package persist

import (
	"os"
	"path/filepath"
	"premark/constants"
	"sync"
)

var (
	execDirCache    string
	execDirOnce     sync.Once
	publicBaseCache string
	publicBaseOnce  sync.Once
)

// ExecDir returns an absolute path anchored to the executable's directory (production)
// or the current working directory (development).
func ExecDir(segments ...string) string {
	execDirOnce.Do(func() {
		var base string
		var err error

		if constants.IS_PROD {
			var exePath string
			exePath, err = os.Executable()
			base = filepath.Dir(exePath)
		} else {
			base, err = os.Getwd()
			base = filepath.Dir(base)
		}

		if err != nil {
			// Panicking here is idiomatic if your app fundamentally
			// cannot start without knowing its own paths.
			panic(err)
		}
		execDirCache = base
	})

	// Safely joins the cached base with any provided path segments
	return filepath.Join(execDirCache, filepath.Join(segments...))
}

// PublicDir returns an absolute path anchored to the application's public asset directory.
func PublicDir(segments ...string) string {
	publicBaseOnce.Do(func() {
		base := ExecDir()

		if constants.IS_PROD {
			publicBaseCache = filepath.Join(base, "")
		} else {
			publicBaseCache = filepath.Join(base, "public", "__")
		}
	})

	return filepath.Join(publicBaseCache, filepath.Join(segments...))
}
