#!/usr/bin/env bash

fswatch diagrams/*.mmd | while read -r FILE; do 
  mmdc -i "$FILE" -o "${FILE/.mmd/@2x.png}" -s 2 -t neutral; 
done