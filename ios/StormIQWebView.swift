import SwiftUI
import WebKit

/// Phase 1: iPhone shell that loads the live Storm IQ web app.
struct StormIQWebView: UIViewRepresentable {
    let url: URL = URL(string: "https://storm-iq.vercel.app")!

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: config)
        web.scrollView.bounces = true
        web.navigationDelegate = context.coordinator
        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // Keep http(s) in-app; open maps:// / tel: externally if needed later
            decisionHandler(.allow)
        }
    }
}

struct ContentView: View {
    var body: some View {
        StormIQWebView()
            .ignoresSafeArea()
    }
}
