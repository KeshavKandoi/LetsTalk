import { describe, expect, it } from 'vitest'
import {
  assertCanConnectAtPlace,
  assertCanRequestFinderPing,
  assertCanSetReady,
  assertCanUpdateFinderProfile,
  buildConversationIntentSummary,
  buildIntentSummary,
  normalizeIntentText,
} from './user-agent-logic'

describe('user-agent logic', () => {
  describe('normalizeIntentText', () => {
    it('collapses whitespace and trims intent text', () => {
      expect(normalizeIntentText('  Open   to a   quick hello \n nearby  ')).toBe(
        'Open to a quick hello nearby',
      )
    })

    it('returns null for blank input', () => {
      expect(normalizeIntentText('   \n\t  ')).toBeNull()
    })
  })

  describe('buildIntentSummary', () => {
    it('uses a calm fallback when intent is empty', () => {
      expect(buildIntentSummary(null)).toBe('Open to a nearby conversation.')
    })

    it('preserves short intent text', () => {
      expect(buildIntentSummary('Open to a quick hello.')).toBe(
        'Open to a quick hello.',
      )
    })

    it('truncates long intent text to a compact summary', () => {
      const summary = buildIntentSummary(
        'Open to a longer conversation about design systems, mobile flows, and what feels calm in person.',
      )

      expect(summary.endsWith('...')).toBe(true)
      expect(summary.length).toBeLessThanOrEqual(72)
    })
  })

  describe('buildConversationIntentSummary', () => {
    it('prefers an existing summary when present', () => {
      expect(
        buildConversationIntentSummary(
          'Already summarized.',
          'This should not be used.',
        ),
      ).toBe('Already summarized.')
    })

    it('falls back to building a summary from intent text', () => {
      expect(buildConversationIntentSummary(null, 'Open to a quick hello.')).toBe(
        'Open to a quick hello.',
      )
    })
  })

  describe('assertCanSetReady', () => {
    it('allows a checked-in user who is not in conversation', () => {
      expect(() =>
        assertCanSetReady({
          currentPlaceId: 'place-1',
          status: 'present',
        }),
      ).not.toThrow()
    })

    it('rejects users without a current place', () => {
      expect(() =>
        assertCanSetReady({
          currentPlaceId: null,
          status: 'offline',
        }),
      ).toThrow('Pick your current place before changing your status.')
    })

    it('rejects users already in a conversation', () => {
      expect(() =>
        assertCanSetReady({
          currentPlaceId: 'place-1',
          status: 'in_conversation',
        }),
      ).toThrow('End your current conversation before changing your status.')
    })
  })

  describe('assertCanUpdateFinderProfile', () => {
    it('allows turning finder mode off without extra checks', () => {
      expect(() =>
        assertCanUpdateFinderProfile({
          profile: {
            currentPlaceId: 'place-1',
            status: 'present',
          },
          isFindable: false,
          locationHint: null,
        }),
      ).not.toThrow()
    })

    it('requires a current place before sharing a hint', () => {
      expect(() =>
        assertCanUpdateFinderProfile({
          profile: {
            currentPlaceId: null,
            status: 'ready',
          },
          isFindable: true,
          locationHint: 'Window seats',
        }),
      ).toThrow('Pick your current place before sharing where you are.')
    })

    it('requires the user to be ready', () => {
      expect(() =>
        assertCanUpdateFinderProfile({
          profile: {
            currentPlaceId: 'place-1',
            status: 'present',
          },
          isFindable: true,
          locationHint: 'Window seats',
        }),
      ).toThrow('Set yourself ready before helping someone find you.')
    })

    it('requires a location hint when enabling finder mode', () => {
      expect(() =>
        assertCanUpdateFinderProfile({
          profile: {
            currentPlaceId: 'place-1',
            status: 'ready',
          },
          isFindable: true,
          locationHint: null,
        }),
      ).toThrow('Choose a spot in the place before turning this on.')
    })
  })

  describe('assertCanConnectAtPlace', () => {
    const validInput = {
      viewerProfile: {
        currentPlaceId: 'place-1',
        status: 'ready' as const,
      },
      targetProfile: {
        currentPlaceId: 'place-1',
        status: 'ready' as const,
      },
      placeId: 'place-1',
      viewerHasActiveConnection: false,
      targetHasActiveConnection: false,
    }

    it('allows a same-place connection when both sides are eligible', () => {
      expect(() => assertCanConnectAtPlace(validInput)).not.toThrow()
    })

    it('rejects viewers who are not checked into the target place', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          viewerProfile: {
            currentPlaceId: 'place-2',
            status: 'ready',
          },
        }),
      ).toThrow('You need to be checked into the same place first.')
    })

    it('rejects viewers already in conversation', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          viewerProfile: {
            currentPlaceId: 'place-1',
            status: 'in_conversation',
          },
        }),
      ).toThrow('End your current conversation before starting another one.')
    })

    it('rejects targets who left the place', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          targetProfile: {
            currentPlaceId: null,
            status: 'ready',
          },
        }),
      ).toThrow('They are no longer checked into this place.')
    })

    it('rejects targets who are not ready', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          targetProfile: {
            currentPlaceId: 'place-1',
            status: 'present',
          },
        }),
      ).toThrow('They are not marked ready right now.')
    })

    it('rejects viewers who already have a connection', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          viewerHasActiveConnection: true,
        }),
      ).toThrow('You are already connected with someone nearby.')
    })

    it('rejects targets who already have a connection', () => {
      expect(() =>
        assertCanConnectAtPlace({
          ...validInput,
          targetHasActiveConnection: true,
        }),
      ).toThrow('They are already in a conversation.')
    })
  })

  describe('assertCanRequestFinderPing', () => {
    const validInput = {
      viewerProfile: {
        currentPlaceId: 'place-1',
        status: 'ready' as const,
      },
      targetProfile: {
        currentPlaceId: 'place-1',
        status: 'ready' as const,
        isFindable: true,
      },
      placeId: 'place-1',
      viewerHasActiveConnection: false,
      targetHasActiveConnection: false,
    }

    it('allows a ping when both people are eligible in the same place', () => {
      expect(() => assertCanRequestFinderPing(validInput)).not.toThrow()
    })

    it('rejects targets who have not shared a findable spot', () => {
      expect(() =>
        assertCanRequestFinderPing({
          ...validInput,
          targetProfile: {
            currentPlaceId: 'place-1',
            status: 'ready',
            isFindable: false,
          },
        }),
      ).toThrow('They have not shared a spot to help you find them.')
    })

    it('rejects seekers already in a conversation', () => {
      expect(() =>
        assertCanRequestFinderPing({
          ...validInput,
          viewerProfile: {
            currentPlaceId: 'place-1',
            status: 'in_conversation',
          },
        }),
      ).toThrow('Finish your current conversation before finding someone else.')
    })
  })
})
