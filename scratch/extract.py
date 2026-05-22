# scratch/extract.py
import os

page_path = "c:/Users/zackr/webgecko/app/admin/page.tsx"
output_path = "c:/Users/zackr/webgecko/app/admin/components/ClientPanel.tsx"

os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(page_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Line 481 is index 480 (0-indexed)
# Line 2211 is index 2210 (0-indexed)
body_lines = lines[481:2211] # Starts from line 482 up to 2211

header = """import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClientAnalytics, DARK, LIGHT } from '../types';
import { GeckoLogo, SparkLine, AnimNum, Pill, InfoRow, ActionBtn, InfoBtn, PreviewFrame, DeployHtmlLive, ClientHtmlUpload } from './UI';

interface ClientPanelProps {
  c: ClientAnalytics;
  secret: string;
  onClose: () => void;
  toast: (msg: string, t: 'ok' | 'err' | 'info') => void;
  dark?: boolean;
}

export default function ClientPanel({ c, secret, onClose, toast, dark = true }: ClientPanelProps) {
  const T = dark ? DARK : LIGHT;
"""

with open(output_path, "w", encoding="utf-8") as f:
    f.write(header)
    f.writelines(body_lines)

print("Extraction successful! Written to", output_path)
