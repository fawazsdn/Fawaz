import XCTest

// Final pre-release native checks: ten photos, accessibility audit, large text, blocked photo links.
final class RcFinal: RcBase {
  let earlier = ["Move earlier", "تحريك للأمام"]
  let later = ["Move later", "تحريك للخلف"]

  func buttons(_ labels: [String]) -> [XCUIElement] {
    app.descendants(matching: .any).matching(NSPredicate(format: "label IN %@", labels)).allElementsBoundByIndex
  }

  func test10_TenPhotosSelectReorderPublish() {
    let text = marker("tenphotos6")
    _ = composePost(text)
    let add = item("add-photos")
    XCTAssertTrue(add.waitForExistence(timeout: 10))
    add.tap()
    let done = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add", "Done", "إضافة", "تم"])).firstMatch
    XCTAssertTrue(done.waitForExistence(timeout: 20), "picker missing")
    sleep(2)
    let cells = app.images.allElementsBoundByIndex.filter { $0.isHittable }
    print("PICKER_HITTABLE_IMAGES: \(cells.count)")
    XCTAssertGreaterThanOrEqual(cells.count, 11, "need eleven photos in the library")
    for c in cells.prefix(11) { c.tap() }  // the 11th must be refused by the picker limit
    shot("ten-picker-after-11-taps")
    done.tap()
    let tiles = app.descendants(matching: .any).matching(identifier: "draft-photo")
    XCTAssertTrue(tiles.element(boundBy: 9).waitForExistence(timeout: 60), "ten draft photos expected")
    sleep(2)
    print("DRAFT_TILES: \(tiles.count)")
    XCTAssertEqual(tiles.count, 10, "exactly ten photos may be attached")
    XCTAssertFalse(add.exists && add.isHittable && add.isEnabled, "add-photos should be unavailable at ten")
    shot("ten-before-reorder")
    // Dismiss the keyboard first so the move taps are not consumed by it.
    app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Post something", "انشر شيئاً"])).firstMatch.tap()
    sleep(1)
    let laterButtons = buttons(later)
    print("MOVE_LATER_BUTTONS: \(laterButtons.count) firstHittable=\(laterButtons.first?.isHittable ?? false) frame=\(laterButtons.first?.frame ?? .zero)")
    laterButtons[0].tap()
    sleep(1)
    shot("ten-after-first-move")
    let e = buttons(earlier)
    print("MOVE_EARLIER_BUTTONS: \(e.count) lastHittable=\(e.last?.isHittable ?? false)")
    e[e.count - 1].tap()
    sleep(1)
    shot("ten-after-reorder")
    tapPublish().tap()
    expectPostScreen("ten-published")
  }

  func audit(_ name: String) {
    var issues: [String] = []
    do {
      try app.performAccessibilityAudit(for: .all) { issue in
        let label = issue.element?.label ?? "-"
        let id = issue.element?.identifier ?? "-"
        issues.append("\(issue.auditType.rawValue)|\(issue.compactDescription)|label=\(label)|id=\(id)|type=\(issue.element?.elementType.rawValue ?? 0)|frame=\(issue.element?.frame ?? .zero)")
        return true  // record, don't fail: the report lists every issue
      }
    } catch {
      issues.append("AUDIT_ERROR|\(error)")
    }
    print("AUDIT[\(name)] count=\(issues.count)")
    for i in issues { print("AUDIT[\(name)] \(i)") }
    shot("audit-\(name)")
  }

  func controls(_ name: String) {
    let interesting = app.descendants(matching: .any).allElementsBoundByIndex.filter {
      ($0.elementType == .button || $0.elementType == .link || $0.elementType == .image) && $0.isHittable
    }
    for el in interesting.prefix(40) {
      print("CONTROL[\(name)] type=\(el.elementType.rawValue) label=\(el.label) id=\(el.identifier)")
    }
  }

  func test11_AccessibilityAudit() {
    open("post/" + rcPost)
    XCTAssertTrue(item("composer-send").waitForExistence(timeout: 15))
    controls("post-comments")
    audit("post-comments")
    open("follows/" + rcIdB + "?tab=followers")
    sleep(3)
    audit("followers-list")
    open("profile/" + rcIdB)
    sleep(4)
    controls("profile-other")
    audit("profile-other")
    open("create/post")
    sleep(3)
    audit("composer")
  }

  func test12_LargeTextScreens() {
    // Content size is set from the host (simctl ui content_size) before this runs.
    open("post/" + rcPost)
    XCTAssertTrue(item("composer-send").waitForExistence(timeout: 15))
    shot("large-post-comments")
    audit("large-post-comments")
    open("profile/" + rcIdB)
    sleep(4)
    shot("large-profile")
    open("create/post")
    sleep(3)
    shot("large-composer")
    app.swipeUp()
    shot("large-composer-lower")
  }

  func test13_BlockedProfilePhoto() {
    // B (private, with a photo) accepted A. Shots before and after B blocks A from the host.
    open("profile/" + rcIdB)
    sleep(5)
    shot("block-before")
    mode("blockab")      // host hook: B blocks A (proxy runs the SQL-free API call)
    open("profile/" + rcIdB)
    sleep(5)
    shot("block-after-reopen")
    app.terminate()
    app.launch()
    sleep(10)
    open("profile/" + rcIdB)
    sleep(5)
    shot("block-after-relaunch")
  }

  func test10b_MoveLaterIsolated() {
    _ = composePost(marker("movecheck2"))
    item("add-photos").tap()
    let done = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add", "Done", "إضافة", "تم"])).firstMatch
    XCTAssertTrue(done.waitForExistence(timeout: 20))
    sleep(2)
    for c in app.images.allElementsBoundByIndex.filter({ $0.isHittable }).prefix(3) { c.tap() }
    done.tap()
    XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "draft-photo").element(boundBy: 2).waitForExistence(timeout: 40))
    print("MOVE_KEYBOARD_BEFORE: \(app.keyboards.count)")
    for _ in 0..<3 where app.keyboards.count > 0 { app.swipeDown(); sleep(1) }
    print("MOVE_KEYBOARD_AFTER_DISMISS: \(app.keyboards.count)")
    shot("move-0-start")
    for n in 1...2 {
      let b = buttons(later)[0]
      print("MOVE_TAP\(n): hittable=\(b.isHittable) enabled=\(b.isEnabled) frame=\(b.frame)")
      b.tap()
      sleep(1)
      shot("move-\(n)")
    }
  }

  func test13b_BlockThenNavigateAwayAndBack() {
    open("profile/" + rcIdB)
    sleep(5)
    shot("block2-before")
    mode("blockab")
    open("post/" + rcPost)   // leave the profile
    sleep(3)
    open("profile/" + rcIdB) // and come back: focus refetch
    sleep(5)
    shot("block2-after-refocus")
    let unavailable = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["هذا الملف غير متاح", "This profile isn't available"])).firstMatch
    XCTAssertTrue(unavailable.waitForExistence(timeout: 10), "blocked profile still shown after refocus")
    XCTAssertFalse(app.staticTexts["RcBravo S.\u{200E}"].exists || app.staticTexts["RcBravo S."].exists, "blocked user's name still on screen")
    print("BLOCK_REFOCUS: unavailable=\(unavailable.exists)")
  }

  func setLanguage(_ target: String) {
    open("settings")
    let language = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS %@", "Language", "اللغة")).firstMatch
    for _ in 0..<8 where !language.isHittable { app.swipeUp() }
    XCTAssertTrue(language.isHittable, "language setting unavailable")
    language.tap()
    let option = item(target)
    XCTAssertTrue(option.waitForExistence(timeout: 10), "language option missing")
    option.tap()
    sleep(3)
  }
  func test14_SwitchToEnglish() { setLanguage("English") }
  func test15_SwitchToArabic() { setLanguage("العربية") }

  func test16_EnglishLargeSameSession() {
    setLanguage("English")
    shot("lang-after-switch")
    test12_LargeTextScreens()
  }
  func test17_LanguageAfterRelaunch() {
    open("post/" + rcPost)
    sleep(4)
    shot("lang-after-relaunch")
    print("LANG_PROBE: english=\(app.staticTexts["Comments"].exists) arabic=\(app.staticTexts["التعليقات"].exists)")
  }
}
