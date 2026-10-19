---
pageClass: rule-details
sidebarDepth: 0
title: vue/no-reserved-props
description: disallow reserved names in props
since: v8.0.0
---

# vue/no-reserved-props

> disallow reserved names in props

- :gear: This rule is included in the following preset configs:
  - `*.configs.essential`
  - `*.configs["strongly-recommended"]`
  - `*.configs.recommended`

## :book: Rule Details

This rule disallow reserved names to be used in props.

<eslint-code-block :rules="{'vue/no-reserved-props': ['error']}">

```vue
<script>
export default {
  props: {
    /* ✗ BAD */
    ref: String,
    key: String,
    /* ✓ GOOD */
    foo: String,
    bar: String,
  }
}
</script>
```

</eslint-code-block>

## :wrench: Options

The optional `vueVersion` setting accepts `3`. It defaults to Vue 3 behavior.

## :couple: Related Rules

- [vue/no-props-shadow](./no-props-shadow.md)

## :rocket: Version

This rule was introduced in eslint-plugin-vue v8.0.0

## :mag: Implementation

- [Rule source](https://github.com/sxzz/eslint-plugin-vuekit/blob/main/lib/rules/no-reserved-props.ts)
- [Test source](https://github.com/sxzz/eslint-plugin-vuekit/blob/main/tests/lib/rules/no-reserved-props.test.ts)
