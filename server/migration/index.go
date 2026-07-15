package migration

import "fmt"

func panicOnError(err error) {
	if err != nil {
		panic(err)
	}
}

func StartMigration() {
	fmt.Println("Starting migration if necessary...")

	panicOnError(MigrateEnv())
	panicOnError(MigratePath())

	fmt.Println("Migration complete.")
	fmt.Println("")
}
