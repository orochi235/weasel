import ApplicationServices
import CoreGraphics
import Foundation
let a = CommandLine.arguments

// `warp check`: can this process do what a headful probe needs? Each grant
// belongs to the app that launched the probe (Terminal, an agent), not to warp.
// Without them nothing errors: captures come back blank and posted moves vanish.
if a.count == 2, a[1] == "check" {
  let session = CGSessionCopyCurrentDictionary() as? [String: Any] ?? [:]
  let locked = (session["CGSSessionScreenIsLocked"] as? Bool) ?? false
  let capture = CGPreflightScreenCaptureAccess()
  let post = CGPreflightPostEventAccess()
  print("screen unlocked: \(!locked)\nScreen Recording: \(capture)\nAccessibility (post events): \(post)")
  exit(!locked && capture && post ? 0 : 1)
}

guard a.count == 3, let x = Double(a[1]), let y = Double(a[2]) else { exit(2) }
let p = CGPoint(x: x, y: y)
CGWarpMouseCursorPosition(p)
CGAssociateMouseAndMouseCursorPosition(1)
// A warp sends no event; Firefox only re-resolves the cursor on a real move.
CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?
  .post(tap: .cghidEventTap)
