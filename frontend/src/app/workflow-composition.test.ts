import { describe, expect, it, vi } from 'vitest'

import type { Character, CharacterApis } from '@/entities'
import { createCharacterCandidateConfirmationAdapter } from './workflow-composition'

function character(): Character {
  return {
    id: 'character-1',
    projectId: 'project-1',
    name: '守夜人',
    outfits: [
      {
        id: 'outfit-1',
        characterId: 'character-1',
        name: '默认造型',
        candidateCharacterTemplates: [
          { id: 'candidate-1', imageUrl: 'old.png', attemptId: 'generation-1' },
        ],
        characterTemplateUrl: 'old.png',
        baseFrames: [],
        actions: [],
      },
    ],
    createdAt: '',
    updatedAt: '',
  }
}

describe('Character candidate confirmation composition', () => {
  it('persists only the selected image and reuses an existing default Outfit', async () => {
    const created = character()
    const update = vi.fn(async (value: Character) => value)
    const apis: CharacterApis = {
      get: vi.fn(),
      listByProject: vi.fn(),
      create: vi.fn(async () => created),
      update,
      remove: vi.fn(),
    }

    const result = await createCharacterCandidateConfirmationAdapter(apis).confirmSelection({
      projectId: 'project-1',
      generationId: 'generation-2',
      selectedImageUrl: 'selected.png',
      description: '守夜人',
    })

    expect(result.outfitId).toBe('outfit-1')
    expect(update).toHaveBeenCalledTimes(1)
    expect(result.character.outfits).toHaveLength(1)
    expect(result.character.outfits[0]?.characterTemplateUrl).toBe('selected.png')
    expect(result.character.outfits[0]?.candidateCharacterTemplates).toEqual([])
  })
})
