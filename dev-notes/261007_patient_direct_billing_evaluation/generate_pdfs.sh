#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="$(cd -- "$script_dir/../../.." && pwd)"
converter_dir="$workspace_root/splint_business_research"
python_bin="$converter_dir/.venv/bin/python"
basic_converter="$converter_dir/md_to_pdf.py"
mermaid_converter="$converter_dir/md_to_pdf_with_mermaid.py"

if [[ ! -x "$python_bin" ]]; then
    printf 'Error: Python environment not found: %s\n' "$python_bin" >&2
    exit 1
fi

if [[ ! -f "$basic_converter" || ! -f "$mermaid_converter" ]]; then
    printf 'Error: PDF converter scripts not found in: %s\n' "$converter_dir" >&2
    exit 1
fi

if (( $# > 0 )); then
    markdown_files=("$@")
else
    shopt -s nullglob
    markdown_files=("$script_dir"/*.md)
fi

if (( ${#markdown_files[@]} == 0 )); then
    printf 'No Markdown files found.\n'
    exit 0
fi

export DYLD_FALLBACK_LIBRARY_PATH="/opt/homebrew/lib${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"

for markdown_file in "${markdown_files[@]}"; do
    if [[ ! -f "$markdown_file" || "${markdown_file##*.}" != "md" ]]; then
        printf 'Error: Not a Markdown file: %s\n' "$markdown_file" >&2
        exit 1
    fi

    converter="$basic_converter"
    if grep -Eq '^```mermaid(-rotated|-fitpage)?[[:space:]]*$' "$markdown_file"; then
        converter="$mermaid_converter"
    fi

    printf 'Generating PDF: %s\n' "$markdown_file"
    (
        cd -- "$converter_dir"
        "$python_bin" "$converter" "$markdown_file"
    )
done