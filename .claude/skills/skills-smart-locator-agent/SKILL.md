---
name: skills-smart-locator-agent
description: "Generate and validate unique, resilient UI locators (Primary + Fallback) for Playwright, Selenium, and Appium from live DOM or mobile hierarchies."
---

# Smart Locator Agent

Purpose: Generate stable and maintainable locators for UI automation.

Applicable frameworks:

- Playwright
- Selenium
- Appium

---

## When to Use

Use this skill when:

- Generating locators for new UI elements
- Reviewing existing locators for stability
- Migrating locators between frameworks

---

## Responsibilities

The agent must:

1. Inspect the DOM or mobile UI hierarchy (NEVER guess)
2. Identify stable attributes
3. Generate a reliable locator
4. Validate locator uniqueness
5. Provide fallback locator if primary is fragile

---

## Locator Priority Matrix (Single Source of Truth)

Always select Primary and Fallback locators strictly following the canonical 3-engine **Locator Priority Matrix** (Playwright Web, Selenium WebDriver, Appium Mobile) and scoping rules defined in [`.claude/rules/locator_strategy.md`](../../rules/locator_strategy.md):

- **Playwright (Web):** `getByRole(role, { name })` → `getByLabel()` / `getByPlaceholder()` → `getByText()` → `getByTestId()` → Scoped CSS `.filter()` → Relative XPath. See [`.claude/rules/playwright_rules.md`](../../rules/playwright_rules.md).
- **Selenium WebDriver (Web):** `By.id()` (stable) → `By.cssSelector("[data-testid='...']")` → `By.name()` → Scoped `By.cssSelector()` → Relative `By.xpath()`. See [`.claude/rules/selenium_rules.md`](../../rules/selenium_rules.md).
- **Appium (Mobile):** `AppiumBy.accessibilityId()` → `AppiumBy.id()` (`resource-id` / `name`) → `androidUIAutomator` / `iOSNsPredicateString` → `iOSClassChain` → Relative `AppiumBy.xpath()`. See [`.claude/rules/appium_rules.md`](../../rules/appium_rules.md).

### Code Examples

```typescript
// Playwright
page.getByRole("button", { name: "Submit" });
page.getByLabel("Email");
page.getByPlaceholder("Enter your password");
```

```java
// Selenium
driver.findElement(By.id("login-button"));
driver.findElement(By.cssSelector("button[data-testid='submit-btn']"));

// Appium
driver.findElement(AppiumBy.accessibilityId("login_button"));
driver.findElement(AppiumBy.id("com.app:id/login_button"));
driver.findElement(AppiumBy.iOSNsPredicateString("label == 'Login'"));
```

---

## Validation Rules

Before using a locator, ensure:

- [ ] It matches exactly one element
- [ ] The element is visible and interactable
- [ ] It is stable across page reloads
- [ ] It survives cosmetic DOM changes (layout, styling)
- [ ] It does NOT use dynamic class names or positional xpath

---

## Output Format

When generating locators, provide:

1. **Primary locator** — The best, most stable option
2. **Fallback locator** — Alternative if primary breaks
3. **Reasoning** — Why this locator was chosen

---

## Rules References

- `.claude/rules/locator_strategy.md` — Master locator priority map
- `.claude/rules/playwright_rules.md` — Playwright-specific locator rules
- `.claude/rules/selenium_rules.md` — Selenium-specific locator rules
- `.claude/rules/appium_rules.md` — Appium-specific locator rules