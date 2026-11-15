`.pi/feishu-work.json` 由 `setup-feishu-work` 生成，没有该文件则直接直接在当前项目下生成spec文档

`.pi/feishu-work.json` 文件中 `root_folder` 字段记录着父文件夹的信息，利用此信息调用 `lark-doc` skill 来创建这个spec文档。
