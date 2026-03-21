package main

import (
	"fmt"
	"math/rand"

	"github.com/pool-break-bit/roundgen/internal/physics"
	"github.com/pool-break-bit/roundgen/internal/quality"
)

func main() {
	base := rand.Int63()
	noPocket := 0
	badTime := 0
	badScatter := 0
	good := 0
	for i := int64(0); i < 200; i++ {
		bc := [15]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
		r := physics.Simulate(base+i, bc)

		if len(r.PocketEvents) == 0 {
			noPocket++
			continue
		}
		firstBallTime := -1
		for _, pe := range r.PocketEvents {
			if pe.BallID != 0 {
				firstBallTime = pe.TMs
				break
			}
		}
		if firstBallTime > 0 && (firstBallTime < 1800 || firstBallTime > 4000) {
			badTime++
			continue
		}

		if !quality.Check(r) {
			badScatter++
			continue
		}
		good++
	}
	fmt.Printf("good=%d noPocket=%d badTime=%d badScatter=%d\n", good, noPocket, badTime, badScatter)

	// Print some sample rounds to see what's happening
	for i := int64(0); i < 5; i++ {
		bc := [15]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
		r := physics.Simulate(base+i, bc)
		fmt.Printf("seed+%d: firstBall=%d pocketEvents=%d samples=%d\n",
			i, r.FirstPocketedBallID, len(r.PocketEvents), len(r.Samples))
		for _, pe := range r.PocketEvents {
			fmt.Printf("  ball=%d pocket=%d t=%dms\n", pe.BallID, pe.PocketID, pe.TMs)
		}
	}
}
