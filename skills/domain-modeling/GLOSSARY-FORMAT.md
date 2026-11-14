# GLOSSARY.md 格式

## 结构

```md
# {上下文名称}

{用一两句话说明这个上下文是什么、为什么存在。}

## 语言

**Order**：
{用一两句话描述这个术语}
_Avoid_：Purchase、transaction

**Invoice**：
货物交付后发给客户的付款请求。
_Avoid_：Bill、payment request

**Customer**：
下单的个人或组织。
_Avoid_：Client、buyer、account
```

## 规则

- **要有立场。** 同一个概念有好几个词时，挑出最好的那一个，其余的列进 `_Avoid_`。
- **定义要收紧。** 最多一两句话。定义它**是什么**，而不是它**做什么**。
- **只收本项目上下文特有的术语。** 通用编程概念（超时、错误类型、工具类模式）不属于这里，即使项目大量使用。加一个术语前先问：这是本上下文独有的概念，还是通用编程概念？只有前者才该收。
- **自然形成聚类时，用子标题分组。** 如果所有术语都落在同一个内聚的领域里，平铺成一张列表就行。

## 单上下文与多上下文仓库

**单上下文（多数仓库）：** 仓库根目录放一个 `GLOSSARY.md`。

**多上下文：** 仓库根目录放一个 `GLOSSARY-MAP.md`，列出各个上下文、它们的位置，以及彼此的关系：

```md
# 术语表地图

## 上下文

- [Ordering](./src/ordering/GLOSSARY.md)：接收并跟踪客户订单
- [Billing](./src/billing/GLOSSARY.md)：生成发票并处理付款
- [Fulfillment](./src/fulfillment/GLOSSARY.md)：管理仓库拣货与发货

## 关系

- **Ordering → Fulfillment**：Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费它们开始拣货
- **Fulfillment → Billing**：Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费它们生成发票
- **Ordering ↔ Billing**：共用 `CustomerId` 与 `Money` 类型
```

该 skill 自己判断适用哪种结构：

- 存在 `GLOSSARY-MAP.md` 时，读它找出各个上下文
- 只在根目录有一个 `GLOSSARY.md` 时，是单上下文
- 两者都不存在时，等第一个术语定下来，再按需创建根目录的 `GLOSSARY.md`

存在多个上下文时，判断当前话题属于哪一个。判断不清就问。
