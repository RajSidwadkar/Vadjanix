# Memory & Principles Guidelines

## Overview
This directory contains the "human-readable memory" and core principles that govern the project's behavior.

## PRINCIPLES.md
- **Source of Truth**: All automated decisions and agent interactions MUST adhere to the mandates in `PRINCIPLES.md`.
- **Logic Implementation**: The engine (see `src/engine.ts`) implements these principles. Any update to `PRINCIPLES.md` must be reflected in the code if applicable.

## Interaction Customization
- When interacting with the user or external systems, prioritize:
  1. **Privacy**: Never share sensitive data like home addresses.
  2. **Rates**: Ensure consultation rates are maintained.
  3. **Scheduling**: Respect the "No Monday mornings" rule.
