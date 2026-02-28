package test

import (
	"fmt"
	"os"
	"testing"
)

func Test(t *testing.T) {
	_, err := os.Create("")
	if err != nil {
		t.Error("hidden 1")
	}

	fmt.Println("hello world")

	if err != nil {
		t.Error(err, "hidden 2")
		// scope in-out { }
		t.Error(err, "hidden 3")
	}

	fmt.Println("visible")

	if err != nil {
		t.Error(err, "hidden 4")
		// } fake scope-out
		t.Error(err, "visible")
	}
}
