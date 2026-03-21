// Package export serialises Round records to the compact JSON format
// consumed by the frontend ReplayLoader.
package export

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/pool-break-bit/roundgen/internal/model"
)

// RoundJSON is the wire format written to disk / stdout.
// The Samples field is a flat [][]float64 to keep the file compact
// (a full round with 300 samples × 33 fields ≈ 10 000 numbers).
type RoundJSON struct {
	Seed      int64          `json:"seed"`
	BC        [15]int        `json:"bc"`  // ballConfig: rack slot → ball ID
	CueX      float64        `json:"cueX"`
	CueY      float64        `json:"cueY"`
	Samples   [][]float64    `json:"s"`   // each inner slice has SampleStride entries
	PE        []PocketEventJ `json:"pe"`
	FirstBall int            `json:"firstBall"` // -1 if none
	FirstPock int            `json:"firstPock"` // -1 if none
}

// PocketEventJ is the JSON form of model.PocketEvent.
type PocketEventJ struct {
	TMs      int `json:"t"`
	BallID   int `json:"b"`
	PocketID int `json:"p"`
}

// MarshalRound converts a model.Round to the wire format.
func MarshalRound(r model.Round) RoundJSON {
	pe := make([]PocketEventJ, len(r.PocketEvents))
	for i, e := range r.PocketEvents {
		pe[i] = PocketEventJ{TMs: e.TMs, BallID: e.BallID, PocketID: e.PocketID}
	}
	samples := make([][]float64, len(r.Samples))
	for i, s := range r.Samples {
		samples[i] = []float64(s)
	}
	return RoundJSON{
		Seed:      r.Seed,
		BC:        r.BallConfig,
		CueX:      r.CueBallSpawnX,
		CueY:      r.CueBallSpawnY,
		Samples:   samples,
		PE:        pe,
		FirstBall: r.FirstPocketedBallID,
		FirstPock: r.FirstPocketedPocketID,
	}
}

// WriteRoundJSON writes a single round to w as indented JSON.
func WriteRoundJSON(w io.Writer, r model.Round) error {
	rj := MarshalRound(r)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(rj)
}

// WriteRoundToFile writes a single round JSON to path (creates/overwrites).
func WriteRoundToFile(path string, r model.Round) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return WriteRoundJSON(f, r)
}

// IndexEntry is one line in the dataset index file (public/data/index.json).
type IndexEntry struct {
	File      string `json:"file"`
	FirstBall int    `json:"firstBall"` // -1 = no ball pocketed, 0 = cue only
	FirstPock int    `json:"firstPock"`
}

// WriteIndex writes the dataset index as a JSON array to path.
func WriteIndex(path string, entries []IndexEntry) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
