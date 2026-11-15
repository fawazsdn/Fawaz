import XCTest

// RC regression cases for the integrated candidate (synthetic stack via the loopback proxy).
// Each test leaves DB verification to rc-verify.sh, keyed by the marker it types.
class RcBase: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "sa.haratna.app.socialdev")
  let publishLabels = ["Publish", "نشر"]
  let okLabels = ["OK", "حسناً", "حسنا", "موافق"]

  override func setUp() {
    continueAfterFailure = false
    mode("online")
    app.launch()
    connectRcMetro()
  }

  /// This build's only Metro is the RC one (port 8082 baked in). Proves the app talks to the RC proxy.
  func connectRcMetro() {
    sleep(10)
    dismissDevMenu()
    _ = hits()
    open("post/" + rcPost)
    if !app.textViews.firstMatch.waitForExistence(timeout: 12) {
      signIn(rcEmailA)
      open("post/" + rcPost)
    }
    XCTAssertGreaterThan(hits(), 0, "app is not talking to the RC proxy (wrong bundle loaded)")
  }

  func hits() -> Int {
    let seen = expectation(description: "hits")
    var n = 0
    URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:55430/_qa/hits")!) { data, _, _ in
      n = Int(String(data: data ?? Data(), encoding: .utf8) ?? "") ?? 0
      seen.fulfill()
    }.resume()
    wait(for: [seen], timeout: 10)
    return n
  }

  func acceptOpenPrompt() {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let openButton = springboard.buttons["Open"]
    if openButton.waitForExistence(timeout: 4) { openButton.tap() }
  }

  override func tearDown() { mode("online") }

  func marker(_ name: String) -> String { "RC \(name) \(rcTag)" }

  func open(_ path: String) {
    app.open(URL(string: "haratna-social-dev://" + path)!)
    acceptOpenPrompt()
    sleep(2)
    dismissDevMenu()
  }

  func shown(_ text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
  }

  func item(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }

  func dismissDevMenu() {
    for label in ["Continue", "Close"] where app.buttons[label].exists { app.buttons[label].tap() }
  }

  func mode(_ value: String) {
    let done = expectation(description: value)
    URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:55430/_qa/" + value)!) { _, _, _ in done.fulfill() }.resume()
    wait(for: [done], timeout: 70)
  }

  func shot(_ name: String) {
    let a = XCTAttachment(screenshot: app.screenshot())
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }

  func type(_ field: XCUIElement, _ text: String) {
    for _ in 0..<4 {
      field.tap()
      sleep(1)
      if (field.value(forKey: "hasKeyboardFocus") as? Bool) == true { break }
    }
    for c in text { app.typeText(String(c)) }
  }

  /// Waits for an alert, records its text, dismisses it. Returns the text.
  @discardableResult func alert(_ name: String, timeout: Double = 25) -> String {
    let modal = app.alerts.firstMatch
    XCTAssertTrue(modal.waitForExistence(timeout: timeout), "\(name): alert missing")
    let text = modal.staticTexts.allElementsBoundByIndex.map(\.label).joined(separator: " | ")
    print("ALERT[\(name)]: \(text)")
    shot(name)
    for l in okLabels where modal.buttons[l].exists { modal.buttons[l].tap(); return text }
    modal.buttons.firstMatch.tap()
    return text
  }

  func signIn(_ email: String) {
    open("sign-in")
    let field = app.textFields.firstMatch
    if !field.waitForExistence(timeout: 10) {
      // Already signed in: sign out from Settings first.
      open("settings")
      let out = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sign out", "Log out", "تسجيل الخروج"])).firstMatch
      for _ in 0..<6 where !out.isHittable { app.swipeUp() }
      XCTAssertTrue(out.isHittable, "sign out unavailable")
      out.tap()
      let confirm = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sign out", "Log out", "تسجيل الخروج"])).allElementsBoundByIndex.last
      if let confirm, confirm.waitForExistence(timeout: 3) { confirm.tap() }
      sleep(2)
      open("sign-in")
      XCTAssertTrue(field.waitForExistence(timeout: 12), "sign-in form missing")
    }
    type(field, email)
    type(app.secureTextFields.firstMatch, rcPassword)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Sign In", "Sign in", "تسجيل الدخول"])).firstMatch.tap()
    XCTAssertTrue(field.waitForNonExistence(timeout: 25), "sign-in did not complete")
    sleep(3)
  }

  // Post composer helpers
  func composePost(_ text: String) -> XCUIElement {
    open("create/post")
    let input = item("caption-input")
    XCTAssertTrue(input.waitForExistence(timeout: 15), "post composer missing")
    type(input, text)
    return input
  }

  func tapPublish() -> XCUIElement {
    let publish = item("publish-button")
    for _ in 0..<4 where !publish.isHittable { app.swipeUp() }
    XCTAssertTrue(publish.isHittable, "publish button unavailable")
    publish.tap()
    let confirm = app.buttons.matching(NSPredicate(format: "label IN %@ AND identifier != %@", publishLabels, "publish-button")).firstMatch
    XCTAssertTrue(confirm.waitForExistence(timeout: 8), "review modal missing")
    return confirm
  }

  func expectPostScreen(_ name: String) {
    XCTAssertTrue(item("composer-send").waitForExistence(timeout: 25), "\(name): did not reach the published post")
    shot(name)
  }

  // Comment helpers
  func commentInput() -> XCUIElement {
    let input = app.textViews.firstMatch
    XCTAssertTrue(input.waitForExistence(timeout: 15), "comment composer missing")
    return input
  }
}

final class RcCases: RcBase {
  func test1_LostPostResponse() {
    let text = marker("r3lostpost")
    let input = composePost(text)
    let confirm = tapPublish()
    mode("droprpc")
    confirm.tap()
    alert("lost-post-response-alert")
    XCTAssertEqual(input.value as? String, text, "draft must survive a lost response")
    mode("online")
    tapPublish().tap()
    expectPostScreen("lost-post-retry-shows-post")
    XCTAssertTrue(shown(text).waitForExistence(timeout: 10))
  }

  func test2_LostCommentResponse() {
    open("post/" + rcPost)
    let text = marker("r2lostcomment")
    let input = commentInput()
    type(input, text)
    mode("droprpc")
    item("composer-send").tap()
    alert("lost-comment-response-alert")
    XCTAssertEqual(input.value as? String, text, "comment draft must survive a lost response")
    mode("online")
    item("composer-send").tap()
    XCTAssertTrue(shown(text).waitForExistence(timeout: 15), "retried comment not shown")
    shot("lost-comment-retry")
  }

  func test3_RapidTaps() {
    open("post/" + rcPost)
    let text = marker("r2rapidcomment")
    type(commentInput(), text)
    mode("slowrpc")
    let send = item("composer-send")
    for _ in 0..<6 { send.tap() }
    XCTAssertTrue(shown(text).waitForExistence(timeout: 20))
    mode("online")
    shot("rapid-comment")

    let post = marker("r2rapidpost")
    _ = composePost(post)
    let confirm = tapPublish()
    mode("slowrpc")
    confirm.tap()
    // Hammer both controls while the request is in flight.
    for _ in 0..<4 {
      let publish = item("publish-button")
      if publish.exists && publish.isHittable { publish.tap() }
      if confirm.exists && confirm.isHittable { confirm.tap() }
    }
    expectPostScreen("rapid-post")
  }

  func test4_KillDuringPublish() {
    let text = marker("killpost2")
    _ = composePost(text)
    let confirm = tapPublish()
    mode("slowrpc")
    confirm.tap()
    sleep(2)  // probe answered, publish committed; its response is held
    app.terminate()
    mode("online")
    app.launch()
    connectRcMetro()
    _ = composePost(text)
    tapPublish().tap()
    expectPostScreen("kill-relaunch-publish")
  }

  func test5_AccountSwitch() {
    let text = marker("r2switch")
    open("post/" + rcPost)
    type(commentInput(), text)
    mode("droprpc")
    item("composer-send").tap()
    alert("switch-a-lost-response")
    mode("online")
    signIn(rcEmailB)
    open("post/" + rcPost)
    type(commentInput(), text)
    item("composer-send").tap()
    XCTAssertTrue(shown(text).waitForExistence(timeout: 15))
    shot("switch-b-own-comment")
    signIn(rcEmailA)
    open("post/" + rcPost)
    type(commentInput(), text)
    item("composer-send").tap()
    sleep(4)
    shot("switch-a-retry")
  }

  func test6_InterruptedMultiPhoto() {
    let text = marker("photos")
    _ = composePost(text)
    let add = item("add-photos")
    XCTAssertTrue(add.waitForExistence(timeout: 10))
    add.tap()
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    for label in ["Allow Full Access", "Allow Access to All Photos", "Allow"] where springboard.buttons[label].exists {
      springboard.buttons[label].tap(); break
    }
    let done = app.buttons.matching(NSPredicate(format: "label IN %@", ["Add", "Done"])).firstMatch
    if !done.waitForExistence(timeout: 12) {
      shot("picker-state")
      print("APP_BUTTONS: " + app.buttons.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
      print("SB_BUTTONS: " + springboard.buttons.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
      print("SB_ALERTS: " + springboard.alerts.allElementsBoundByIndex.map(\.label).joined(separator: " | "))
    }
    XCTAssertTrue(done.exists, "picker missing")
    let cells = app.images.allElementsBoundByIndex.filter { $0.isHittable }
    XCTAssertGreaterThanOrEqual(cells.count, 2, "need two photos in the library")
    cells[0].tap(); cells[1].tap()
    shot("picker-two-selected")
    done.tap()
    let tiles = app.descendants(matching: .any).matching(identifier: "draft-photo")
    XCTAssertTrue(tiles.element(boundBy: 1).waitForExistence(timeout: 20), "two draft photos expected")
    let confirm = tapPublish()
    mode("uploadone")
    confirm.tap()
    alert("photo-batch-interrupted")
    mode("online")
    tapPublish().tap()
    expectPostScreen("photo-batch-retried")
  }

  func test7_CleanupWhilePublishing() {
    // An abandoned upload was planted beforehand (rc-plant-abandoned.sh).
    let text = marker("cleanuprace2")
    _ = composePost(text)
    let confirm = tapPublish()
    mode("slowrpc")
    confirm.tap()
    sleep(1)
    mode("cleanup")  // runs the cleanup job while the publish is in flight
    expectPostScreen("cleanup-during-publish")
    mode("online")
  }

  func test8_PostingPausedEnglishArabic() {
    open("post/" + rcPost)
    mode("nofunc")
    let input = commentInput()
    type(input, marker("r2pausedcomment"))
    item("composer-send").tap()
    let comment = alert("paused-comment-current-language")
    _ = composePost(marker("r2pausedpost"))
    tapPublish().tap()
    let post = alert("paused-post-current-language")
    print("PAUSED_TEXTS: \(comment) || \(post)")
    mode("online")
  }

  func switchLanguage(to target: String) {
    open("settings")
    let language = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS %@", "Language", "اللغة")).firstMatch
    for _ in 0..<6 where !language.isHittable { app.swipeUp() }
    XCTAssertTrue(language.isHittable, "language setting unavailable")
    language.tap()
    let option = item(target)
    XCTAssertTrue(option.waitForExistence(timeout: 10), "language option missing")
    option.tap()
    sleep(3)
  }

  func test9_EnglishPausedAndRtlLtrNavigation() {
    switchLanguage(to: "English")
    test8_PostingPausedEnglishArabic()
    // Comment rendering and back gesture, English (left edge).
    open("post/" + rcPost)
    XCTAssertTrue(shown(marker("r2lostcomment")).waitForExistence(timeout: 15), "English: comment not rendered")
    shot("english-comments")
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5)).press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)))
    sleep(2)
    XCTAssertFalse(item("composer-send").exists, "English left-edge swipe did not go back")
    shot("english-after-back")
    // Arabic (right edge).
    switchLanguage(to: "العربية")
    open("post/" + rcPost)
    XCTAssertTrue(shown(marker("r2lostcomment")).waitForExistence(timeout: 15), "Arabic: comment not rendered")
    shot("arabic-comments")
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.5)).press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)))
    sleep(2)
    XCTAssertFalse(item("composer-send").exists, "Arabic right-edge swipe did not go back")
    shot("arabic-after-back")
  }
}
