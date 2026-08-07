# Character Detail Workflow Entrances

角色详情页只负责从正式 Character 资产定位回工作流，不在资产页执行生成。

- “增加动作”先用 `projectId + characterId` 查找角色唯一 Run，再打开
  `/workflow-editor/:runId?intent=add-action`。
- “重新生成动作”先用后端正式 `actionId` 反查前端 `stepId`，再打开
  `/workflow-editor/:runId/:stepId?intent=regenerate-action`。

真正的 Action Step 追加和 Revision 重启由 Workflow Editor Service 调用 WorkflowController
完成。找不到 Run 或 Step 时页面显示明确错误，不创建补偿 Run，也不修改 Playtest。

