import XCTest

// Explore (Community & Friends) walkthrough on Haratna Staging with synthetic data.
// The app is pre-signed-in as a synthetic account; nothing here signs in or writes.
final class RcExplore: XCTestCase {
  let env = ProcessInfo.processInfo.environment
  lazy var app = XCUIApplication(bundleIdentifier: env["EXPLORE_BUNDLE"] ?? "sa.haratna.app.staging.explorereview")
  lazy var dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
  lazy var lang = env["SHOT_LANG"] ?? "ar"

  func ar(_ a: String, _ e: String) -> String { lang == "ar" ? a : e }
  func label(_ text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", text)).firstMatch
  }
  func contains(_ text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
  }
  func shot(_ name: String) {
    let png = XCUIScreen.main.screenshot().pngRepresentation
    try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(lang)-\(name).png"))
    let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
  }
  func log(_ s: String) { print("EXPLORE[\(lang)] \(s)") }

  func testExploreWalkthrough() {
    continueAfterFailure = true
    app.launch()
    sleep(6)
    let tab = label(ar("استكشف", "Explore"))
    XCTAssertTrue(tab.waitForExistence(timeout: 20), "Explore tab")
    tab.tap()
    let community = label(ar("المجتمع", "Community"))
    XCTAssertTrue(community.waitForExistence(timeout: 15), "Community tab")
    XCTAssertTrue(contains(ar("ممشى", "ممشى")).waitForExistence(timeout: 20), "Noura's local post")
    sleep(4)  // photos load through authenticated Storage requests
    shot("01-community")
    log("community selected=\(community.isSelected) friends-visible=\(label(ar("الأصدقاء", "Friends")).exists)")
    XCTAssertFalse(contains("حساب خاص").exists, "private account post leaked")
    XCTAssertFalse(contains("مستخدم محظور").exists, "blocked user post leaked")

    // Scroll to the nearby post (ranked after local posts).
    let nearby = contains("مقهى جديد")
    for _ in 0..<12 where !nearby.isHittable { app.swipeUp(velocity: .fast); sleep(1) }
    log("nearby post found=\(nearby.exists)")
    XCTAssertTrue(contains("Reem H.").exists, "nearby public author shown by masked name")
    XCTAssertFalse(label(ar("جار", "Neighbor")).exists, "generic Neighbor label still shown")
    log("nearby author named=\(contains("Reem H.").exists)")
    shot("02-community-nearby")

    // Friends: tap the switcher.
    let friends = label(ar("الأصدقاء", "Friends"))
    friends.tap()
    XCTAssertTrue(contains("وادي حنيفة").waitForExistence(timeout: 20), "Faisal's post in Friends")
    sleep(4)
    shot("03-friends")
    XCTAssertFalse(contains("سوق المزارعين").exists, "unfollowed author in Friends")
    XCTAssertFalse(contains("مستخدم محظور").exists, "blocked user in Friends")

    // Swipe back to Community (horizontal paging; direction follows the layout).
    let page = app.scrollViews.firstMatch
    if lang == "ar" { page.swipeLeft() } else { page.swipeRight() }
    sleep(3)
    log("after swipe community post visible=\(contains("ممشى").exists)")
    shot("04-swiped-back")

    // Pull to refresh.
    app.swipeDown(velocity: .slow)
    sleep(4)
    shot("05-refreshed")

    // Open a post (comments, likes, share).
    let post = contains("ممشى")
    if post.waitForExistence(timeout: 10) { post.tap() }
    sleep(5)
    shot("06-post-detail")
    log("detail comment visible=\(contains("ممشى حديقة الحي").exists)")
  }
}
