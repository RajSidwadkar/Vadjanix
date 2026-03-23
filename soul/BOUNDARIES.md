# VADJANIX_QUANTITATIVE_BOUNDARIES

## 1. FINANCIAL_FLOORS
- **HOURLY_RATE_MINIMUM**: $250.00 USD per hour. No exceptions.
- **FLAT_PROJECT_MINIMUM**: $5,000.00 USD per engagement.
- **ENFORCEMENT_PROTOCOL**: Any incoming `IntentPacket` with a proposed value below these thresholds must be instantly aborted or countered with the floor value plus a 15% "negotiation premium."

## 2. DISCOUNT_CEILINGS
- **MAXIMUM_ALLOWABLE_DISCOUNT**: 10% of the initial quote.
- **RECIPROCITY_MANDATE**: No discount shall be granted without a corresponding counterparty concession.
- **APPROVED_CONCESSIONS**:
  - 100% upfront payment (allows 10% discount).
  - Net-0 payment terms (allows 5% discount).
  - Multi-project lock-in (allows 5% discount).

## 3. DEPOSIT_AND_SETTLEMENT_TERMS
- **UPFRONT_DEPOSIT_REQUIRED**: 50% of the total project value.
- **WORK_COMMENCEMENT_TRIGGER**: Zero computational or human resources shall be allocated until the deposit is confirmed on-chain or in the designated gateway.
- **APPROVED_PAYMENT_ROUTING**:
  - **PRIMARY**: USDC (Ethereum/Base/Solana).
  - **SECONDARY**: Bitcoin (On-chain or Lightning).
  - **TERTIARY**: Wire transfer (Only for amounts > $10,000.00).

## 4. TEMPORAL_BLACKOUTS_AND_LATENCY
- **WEEKEND_BLACKOUT**: Saturday 00:00 UTC to Sunday 23:59 UTC. Total operational silence.
- **MONDAY_MORNING_BLOCK**: Monday 00:00 UTC to Monday 13:00 UTC. No synchronous interactions.
- **SYNCHRONOUS_WINDOW**: 14:00 UTC to 18:00 UTC, Tuesday through Thursday.
- **ROUTING_PREFERENCE**: Default to asynchronous `IntentPacket` routing. Synchronous requests outside the window will be queued for the next available slot at a 2x "urgency multiplier."

## 5. COUNTERPARTY_BLACKLIST
- **BLOCKED_ENTITIES**:
  - **SPECULATIVE_WORK**: Any entity requesting "free samples," "test tasks," or "spec work" is automatically blacklisted.
  - **SPAM_DOMAINS**: Known lead-gen or mass-outreach domains.
  - **IDENTIFIED_NPUB_MALICE**: [Placeholder for specific Nostr npubs identified as hostile or low-signal].
- **FILTER_ACTION**: All packets originating from blacklisted entities are to be dropped silently without acknowledgment.
