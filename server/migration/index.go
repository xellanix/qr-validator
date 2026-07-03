package migration

import "fmt"

func StartMigration() {
	fmt.Println("Starting migration if necessary...")
	err := MigrateEnv()
	if err != nil {
		panic(err)
	}
	fmt.Println("Migration complete.")
	fmt.Println("")
}
