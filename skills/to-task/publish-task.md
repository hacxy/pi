# 发布飞书任务

把任务发布到飞书,自动定位或创建项目任务清单,以 bot 身份创建任务,并按需建立任务依赖关系。

## 步骤

### 1. 确定项目名称

用 `gh` 获取当前项目的 GitHub 项目名称;如果当前不是 GitHub 项目,则使用当前项目目录名:

```bash
PROJECT="$(gh repo view --json name -q .name 2>/dev/null || basename "$PWD")"
```

### 2. 定位或创建任务清单

用项目名称查询任务清单(查询仅支持 user 身份):

```bash
lark-cli task +tasklist-search --query "$PROJECT" --as user
```

- 查到清单:记下返回的 `tasklist_guid`,跳过创建。
- 未查到:用项目名称创建清单,记下新清单的 guid:

```bash
lark-cli task +tasklist-create --name "$PROJECT" --as user
```

### 3. 确保 ready-for-agent 标签存在

标签 = 单选/多选类型的自定义字段,归属于清单。先列出清单的自定义字段,拿到**标签字段 guid** 和 **ready-for-agent 选项 guid**:

```bash
lark-cli schema task.custom_fields.list
lark-cli task custom_fields list \
  --params '{"resource_type":"tasklist","resource_id":"<清单guid>"}' --as user
```

- 选项不存在时,创建它并记下返回的选项 guid:

```bash
lark-cli api POST "/open-apis/task/v2/custom_fields/<标签字段guid>/options" \
  --data '{"name":"ready-for-agent"}' --as user
```

- 清单没有任何标签字段时,先 `lark-cli schema task.custom_fields.create`、`lark-cli schema task.custom_fields.add` 创建多选字段并绑定到清单。

### 4. 创建任务(bot 身份,底层接口)

创建时带标题(`summary`)、内容(`description`)和 `ready-for-agent` 标签:

```bash
lark-cli api POST "/open-apis/task/v2/tasks" --as bot \
  --data '{"summary":"<任务标题>","description":"<任务内容>","tasklists":[{"tasklist_guid":"<清单guid>"}],"custom_fields":[{"guid":"<标签字段guid>","multi_select_value":["<ready-for-agent选项guid>"]}]}'
```

多选字段用 `multi_select_value`,单选字段改用 `single_select_value`。若被依赖任务已存在,可在 body 直接内联依赖:

```bash
lark-cli api POST "/open-apis/task/v2/tasks" --as bot \
  --data '{"summary":"<任务标题>","description":"<任务内容>","tasklists":[{"tasklist_guid":"<清单guid>"}],"custom_fields":[{"guid":"<标签字段guid>","multi_select_value":["<ready-for-agent选项guid>"]}],"dependencies":[{"type":"prev","task_guid":"<前置任务guid>"},{"type":"next","task_guid":"<后置任务guid>"}]}'
```

从响应中提取 `task.guid` 和 `task.url`,后续引用任务一律使用该 guid。

### 5. 设置任务依赖(可选)

在 B 上添加依赖:`type: prev` 声明前置任务 A(A 完成后 B 才开始),`type: next` 声明后置任务 C(B 完成后 C 才开始):

```bash
# 添加前置任务:B 的前置任务是 A
lark-cli api POST "/open-apis/task/v2/tasks/<B>/add_dependencies" \
  --data '{"dependencies":[{"type":"prev","task_guid":"<A>"}]}' --as user

# 添加后置任务:B 的后置任务是 C
lark-cli api POST "/open-apis/task/v2/tasks/<B>/add_dependencies" \
  --data '{"dependencies":[{"type":"next","task_guid":"<C>"}]}' --as user

# 移除依赖
lark-cli api POST "/open-apis/task/v2/tasks/<B>/remove_dependencies" \
  --data '{"dependencies":[{"type":"prev","task_guid":"<A>"}]}' --as user
```

## 注意

- 任务 id 一律使用接口返回的 guid,不要用客户端展示编号(如 `t104121`)。
- 清单查询(`+tasklist-search`)仅支持 user 身份;创建任务必须用 bot 身份。
- 多任务按依赖顺序逐个发布:被依赖的先发,以便依赖边引用真实 guid。
