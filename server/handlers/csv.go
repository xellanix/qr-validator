package handlers

import (
	"bytes"
	"encoding/csv"

	"premark/db"
	"premark/lib"

	"github.com/gofiber/fiber/v3"
)

func HandleSubmitCSV(c fiber.Ctx) error {
	datasetId := c.Query("id")
	datasetKey := c.Query("key")
	if datasetId == "" || datasetKey == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Bad Request")
	}

	userHashStr := c.Cookies("user_hash")
	if userHashStr == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	userHashBytes, err := lib.Base64ToBytes(userHashStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Bad Request: Invalid encoding")
	}

	rows, err := lib.StreamCSVRows(c.Body())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(err.Error())
	}

	changes, err := db.AddDatasetRows(userHashBytes, datasetId, rows, datasetKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error")
	}

	return c.JSON(changes)
}

func HandleExtractCSVColumns(c fiber.Ctx) error {
	body := c.Body()
	if lib.IsBinaryPayload(body) {
		return c.Status(fiber.StatusBadRequest).SendString("Forbidden: Executable context payloads are blocked")
	}

	reader := csv.NewReader(bytes.NewReader(body))
	headers, err := reader.Read()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Error parsing CSV headers")
	}

	return c.JSON(headers)
}
