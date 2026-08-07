import type { CharacterApis, CharacterCandidateConfirmationApis } from '@/entities'

/**
 * 当前 Character API 还没有“确认候选并清理其余缓存”的独立端点，这个适配器先用已有的
 * create + update 契约保存唯一选中的图片。其余三个候选 URL 从未写入 WorkflowRun 或
 * Character；等后端提供原子确认接口时，只替换本适配器，页面和 Controller 均无需改动。
 */
export function createCharacterCandidateConfirmationAdapter(
  characterApis: CharacterApis,
): CharacterCandidateConfirmationApis {
  return {
    async confirmSelection({ projectId, selectedImageUrl, description }) {
      const character = await characterApis.create({
        projectId,
        name: description.trim() || null,
        description,
        referenceImageUrl: selectedImageUrl,
      })
      const existingOutfit = character.outfits[0]
      const outfitId = existingOutfit?.id ?? `outfit-${character.id}-default`
      const saved = await characterApis.update({
        ...character,
        outfits: existingOutfit
          ? character.outfits.map((outfit, index) =>
              index === 0
                ? {
                    ...outfit,
                    candidateCharacterTemplates: [],
                    characterTemplateUrl: selectedImageUrl,
                  }
                : outfit,
            )
          : [
              {
                id: outfitId,
                characterId: character.id,
                name: '默认造型',
                description: null,
                candidateCharacterTemplates: [],
                characterTemplateUrl: selectedImageUrl,
                baseFrames: [],
                actions: [],
              },
            ],
      })
      return { character: saved, outfitId }
    },
  }
}
