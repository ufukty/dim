package test

import (
	"fmt"
	"os"
	"testing"
)

func Test(t *testing.T) {
	_, err := os.Create("")

	if err != nil {
		t.Error("hidden")
	}

	if err != nil {
		t.Error(err, "hidden")
		// scope in-out { }
		t.Error(err, "hidden")
	}

	fmt.Println("visible")

	if err != nil {
		t.Error(err, "hidden")
		// } fake scope-out
		t.Error(err, "visible")
	}
}
