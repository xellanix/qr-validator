package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type VersionConfig struct {
	Version string `json:"version"`
}

// VersionInfo mirrors the structure goversioninfo expects.
type VersionInfo struct {
	FixedFileInfo  FixedFileInfo  `json:"FixedFileInfo"`
	StringFileInfo StringFileInfo `json:"StringFileInfo"`
	VarFileInfo    VarFileInfo    `json:"VarFileInfo"`
	IconPath       string         `json:"IconPath"`
}

type FileVersion struct {
	Major int `json:"Major"`
	Minor int `json:"Minor"`
	Patch int `json:"Patch"`
	Build int `json:"Build"`
}

type FixedFileInfo struct {
	FileVersion    FileVersion `json:"FileVersion"`
	ProductVersion FileVersion `json:"ProductVersion"`
	FileFlagsMask  string      `json:"FileFlagsMask"`
	FileFlags      string      `json:"FileFlags"`
	FileOS         string      `json:"FileOS"`
	FileType       string      `json:"FileType"`
	FileSubType    string      `json:"FileSubType"`
}

type StringFileInfo struct {
	CompanyName     string `json:"CompanyName"`
	FileDescription string `json:"FileDescription"`
	FileVersion     string `json:"FileVersion"`
	ProductName     string `json:"ProductName"`
	ProductVersion  string `json:"ProductVersion"`
	LegalCopyright  string `json:"LegalCopyright"`
}

type Translation struct {
	LangID    string `json:"LangID"`
	CharsetID string `json:"CharsetID"`
}

type VarFileInfo struct {
	Translation Translation `json:"Translation"`
}

// parseVersion splits "1.2.3" (or "1.2.3.4") into up to 4 ints.
// Missing parts default to 0. Non-numeric input returns an error.
func parseVersion(version string) (FileVersion, error) {
	parts := strings.Split(strings.TrimPrefix(version, "v"), ".")
	nums := make([]int, 4)

	for i := 0; i < len(parts) && i < 4; i++ {
		n, err := strconv.Atoi(strings.TrimSpace(parts[i]))
		if err != nil {
			return FileVersion{}, fmt.Errorf("invalid version segment %q in %q: %w", parts[i], version, err)
		}
		nums[i] = n
	}

	return FileVersion{
		Major: nums[0],
		Minor: nums[1],
		Patch: nums[2],
		Build: nums[3],
	}, nil
}

// GenerateVersionInfoParams holds the fields needed to build versioninfo.json.
type GenerateVersionInfoParams struct {
	Version     string // e.g. "1.2.3"
	Title       string // ProductName / FileDescription
	Publisher   string // CompanyName
	Description string // FileDescription
	Copyright   string
	IconPath    string
	OutputPath  string // where to write the JSON, e.g. "versioninfo.json"
}

// GenerateVersionInfo writes a versioninfo.json file compatible with goversioninfo.
func GenerateVersionInfo(p GenerateVersionInfoParams) error {
	fv, err := parseVersion(p.Version)
	if err != nil {
		return fmt.Errorf("Generate versioninfo: %w", err)
	}

	versionStr := fmt.Sprintf("%d.%d.%d.%d", fv.Major, fv.Minor, fv.Patch, fv.Build)

	info := VersionInfo{
		FixedFileInfo: FixedFileInfo{
			FileVersion:    fv,
			ProductVersion: fv,
			FileFlagsMask:  "3f",
			FileFlags:      "00",
			FileOS:         "40004",
			FileType:       "01",
			FileSubType:    "00",
		},
		StringFileInfo: StringFileInfo{
			CompanyName:     p.Publisher,
			FileDescription: p.Description,
			FileVersion:     versionStr,
			ProductName:     p.Title,
			ProductVersion:  versionStr,
			LegalCopyright:  p.Copyright,
		},
		VarFileInfo: VarFileInfo{
			Translation: Translation{
				LangID:    "0409",
				CharsetID: "04B0",
			},
		},
		IconPath: p.IconPath,
	}

	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("Marshal versioninfo: %w", err)
	}

	if err := os.WriteFile(p.OutputPath, data, 0644); err != nil {
		return fmt.Errorf("Write versioninfo file %q: %w", p.OutputPath, err)
	}

	return nil
}

func main() {
	fmt.Println("⌛ Preparing build...")

	// Emulate the version.json loading layer
	versionPath := filepath.Clean("./frontend/data/version.json")
	versionBytes, err := os.ReadFile(versionPath)
	appVersion := "1.0.0"

	if err == nil {
		var vCfg VersionConfig
		if json.Unmarshal(versionBytes, &vCfg) == nil && vCfg.Version != "" {
			appVersion = vCfg.Version
		}
	} else {
		fmt.Printf("⚠️ Warning: version.json not found, defaulting to %s\n", appVersion)
	}

	// Set cross-compilation target environment parameters
	os.Setenv("GOOS", "windows")
	os.Setenv("GOARCH", "amd64")

	err = GenerateVersionInfo(GenerateVersionInfoParams{
		Version:     appVersion,
		Title:       "Xellanix PreMark",
		Publisher:   "Xellanix",
		Description: "Xellanix PreMark",
		Copyright:   "Copyright (c) 2025-2026, Xellanix",
		IconPath:    "../public/favicon.ico",
		OutputPath:  "./server/build/versioninfo.json",
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}

	// Generate native Windows metadata using go-winres
	// Ensures Version, Publisher, Copyright, and Icon entries compile into the executable structure
	fmt.Println("📦 Embedding Windows resource metadata...")
	winresCmd := exec.Command("go", "run", "github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest", "-o", "resource.syso", "build/versioninfo.json")
	winresCmd.Dir = "server/"
	winresCmd.Stdout = os.Stdout
	winresCmd.Stderr = os.Stderr
	if err := winresCmd.Run(); err != nil {
		fmt.Printf("❌ Failed processing Windows metadata assets: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("⌛ Building Go server...")

	// Setup deep code minification configurations
	// -s: Strips structural DWARF debug information
	// -w: Strips local symbol runtime tables (massively slims down output executable files)
	// -X: Directly injects variables into memory namespaces (replicates define blocks)
	outPath := filepath.Clean("../dist/server/premark.exe")

	// Create output directories if missing
	_ = os.MkdirAll(filepath.Dir(outPath), 0755)

	ldFlags := fmt.Sprintf("-s -w -X main.Version=%s", appVersion)

	buildArgs := []string{
		"build",
		"-ldflags", ldFlags,
		"-tags", "production",
		"-o", outPath,
		".",
	}

	buildCmd := exec.Command("go", buildArgs...)
	buildCmd.Dir = "server/" // Executes from project base context directory
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr

	if err := buildCmd.Run(); err != nil {
		fmt.Printf("❌ Failed to compile Go server binary: %v\n", err)
		os.Exit(1)
	}

	// Clean up intermediate .syso resources generated during metadata phase
	_ = os.Remove("./server/resource.syso")

	fmt.Printf("✅ Successfully built server: %s [Version: %s]\n", outPath, appVersion)
}
