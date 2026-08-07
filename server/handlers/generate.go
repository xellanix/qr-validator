package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"premark/db"
	"premark/lib"
	"premark/sockets"
	"time"

	"github.com/gofiber/fiber/v3"
)

func normalizeRow(row db.ReportRow) {
	temp, _ := row.Value("createdAt").(int64)
	if temp == 0 {
		row.Set("createdAt", "")
	} else {
		row.Set("createdAt", time.Unix(0, temp).Local().Format("2006-01-02 15:04:05"))
	}
}

func getReportName(projectId string, batchNumber int, sorted bool, extension string) string {
	now := time.Now()
	timemark := fmt.Sprintf("%04d%02d%02d", now.Year(), int(now.Month()), now.Day())

	var s string
	if sorted {
		s = "_sorted"
	}

	fileName := fmt.Sprintf("presence_report_%s_%d%s_%s.%s", projectId, batchNumber, s, timemark, extension)

	return fileName
}

func HandleGenerateReport(c fiber.Ctx) error {
	type generateReportRequest struct {
		ProjectId   string `uri:"project"`
		BatchNumber int    `uri:"batch"`
		Extension   string `uri:"ext"`
		Sorted      bool   `uri:"sorted"`
	}

	var req generateReportRequest
	if err := c.Bind().URI(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Bad Request")
	}

	token := c.Cookies("auth_token")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	user, err := lib.VerifyUserJWT(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	if !sockets.GetPermissions(user.AuthorizeLevel).CanReport {
		return c.Status(fiber.StatusForbidden).SendString("Forbidden: Insufficient Permissions")
	}

	fmt.Println("Generate report request...")
	fmt.Printf("> Project ID: %s\n", req.ProjectId)
	fmt.Printf("> Batch Number: %d\n", req.BatchNumber)
	fmt.Printf("> Is Sorted: %t\n", req.Sorted)
	fmt.Printf("> Extension: %s\n", req.Extension)

	// Join dataset_rows with presence_histories from the same batch number and project ID.
	// From dataset_rows, get the payload.
	// From the presence_histories, get the presence_by_user_hash, created_at_ns, and, status.
	// If the row is found in the history table, then set "present" to true. Otherwise, set it to false.
	// So the joined table will look like this:
	// present, payload, presence_by_user_hash, created_at_ns, status.
	//
	// Then decrypt the payload to get the row data, including the row_key.
	// Always sort the rows by the row_key in ascending order.
	// If there are several rows with the same row_key, then sort them by the created_at_ns value in ascending order.
	//
	// If "sorted" (golang) is true, then group them by "present" in ascending order (false first, then true).

	datasetKeys, reportRows, err := db.GenerateReport(req.ProjectId, req.BatchNumber, req.Sorted)
	if err != nil {
		fmt.Println(err)
		return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error: Error generating report")
	}

	switch req.Extension {
	case "json":
		for _, row := range reportRows {
			normalizeRow(row)
		}

		// Indent JSON with 2 spaces
		prettyJSON, err := json.MarshalIndent(reportRows, "", "  ")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error: Error encoding JSON")
		}

		c.Attachment(getReportName(req.ProjectId, req.BatchNumber, req.Sorted, "json"))
		return c.Send(prettyJSON)
	case "csv":
		buf := new(bytes.Buffer)
		writer := csv.NewWriter(buf)

		headers := append([]string{"Present"}, datasetKeys...)
		headers = append(headers, "Presence By", "Created At", "Status")

		if err = writer.Write(headers); err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error: Error writing CSV headers")
		}

		tempHeaders := append([]string{"present"}, datasetKeys...)
		tempHeaders = append(tempHeaders, "presenceBy", "createdAt", "status")

		for _, row := range reportRows {
			normalizeRow(row)

			record := make([]string, 0, len(tempHeaders))
			for _, header := range tempHeaders {
				val, _ := row.Value(header).(string)
				record = append(record, val)
			}

			if err = writer.Write(record); err != nil {
				return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error: Error writing CSV row")
			}
		}

		writer.Flush()
		if err = writer.Error(); err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Internal Server Error: Error writing CSV")
		}

		c.Attachment(getReportName(req.ProjectId, req.BatchNumber, req.Sorted, "csv"))
		return c.Send(buf.Bytes())
	}

	return c.Status(fiber.StatusBadRequest).SendString("Bad Request")
}
