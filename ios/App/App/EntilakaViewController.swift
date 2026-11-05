import UIKit
import WebKit
import Capacitor

/// Keeps the Entilaka launch screen up until the site finishes its first load,
/// then shows a thin progress line for later page changes inside the app.
class EntilakaViewController: CAPBridgeViewController {
    private let launchOverlay = UIView()
    private let launchTrack = UIView()
    private let launchFill = UIView()
    private let topTrack = UIView()
    private let topFill = UIView()
    private var progressObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?
    private var zoomObservation: NSKeyValueObservation?
    private var didInstallZoomLock = false
    private var hasFinishedFirstLoad = false
    private var launchFillWidth: NSLayoutConstraint?
    private var topFillWidth: NSLayoutConstraint?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if let webView { lockPageScale(webView) }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.navy
        installLaunchOverlay()
        installTopBar()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView else { return }
        lockPageScale(webView)
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] webView, _ in
            self?.apply(progress: webView.estimatedProgress, loading: webView.isLoading)
        }
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            self?.apply(progress: webView.estimatedProgress, loading: webView.isLoading)
            if !webView.isLoading { self?.keepFieldFocusFromZooming(webView) }
        }
    }

    deinit {
        progressObservation?.invalidate()
        loadingObservation?.invalidate()
        zoomObservation?.invalidate()
    }

    private func installLaunchOverlay() {
        launchOverlay.translatesAutoresizingMaskIntoConstraints = false
        launchOverlay.backgroundColor = Self.navy
        view.addSubview(launchOverlay)

        let image = UIImageView(image: UIImage(named: "Splash"))
        image.translatesAutoresizingMaskIntoConstraints = false
        image.contentMode = .scaleAspectFill
        image.clipsToBounds = true
        launchOverlay.addSubview(image)

        launchTrack.translatesAutoresizingMaskIntoConstraints = false
        launchTrack.backgroundColor = UIColor.white.withAlphaComponent(0.16)
        launchTrack.layer.cornerRadius = 2
        launchOverlay.addSubview(launchTrack)

        launchFill.translatesAutoresizingMaskIntoConstraints = false
        launchFill.backgroundColor = Self.sky
        launchFill.layer.cornerRadius = 2
        launchTrack.addSubview(launchFill)
        let width = launchFill.widthAnchor.constraint(equalToConstant: 18)
        launchFillWidth = width

        NSLayoutConstraint.activate([
            launchOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            launchOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            launchOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            launchOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            image.leadingAnchor.constraint(equalTo: launchOverlay.leadingAnchor),
            image.trailingAnchor.constraint(equalTo: launchOverlay.trailingAnchor),
            image.topAnchor.constraint(equalTo: launchOverlay.topAnchor),
            image.bottomAnchor.constraint(equalTo: launchOverlay.bottomAnchor),
            launchTrack.centerXAnchor.constraint(equalTo: launchOverlay.centerXAnchor),
            launchTrack.centerYAnchor.constraint(equalTo: launchOverlay.centerYAnchor, constant: 92),
            launchTrack.widthAnchor.constraint(equalToConstant: 112),
            launchTrack.heightAnchor.constraint(equalToConstant: 4),
            launchFill.leadingAnchor.constraint(equalTo: launchTrack.leadingAnchor),
            launchFill.topAnchor.constraint(equalTo: launchTrack.topAnchor),
            launchFill.bottomAnchor.constraint(equalTo: launchTrack.bottomAnchor),
            width,
        ])
    }

    private func installTopBar() {
        topTrack.translatesAutoresizingMaskIntoConstraints = false
        topTrack.backgroundColor = .clear
        topTrack.isHidden = true
        if usesRightToLeft {
            topTrack.semanticContentAttribute = .forceRightToLeft
        }
        view.addSubview(topTrack)

        topFill.translatesAutoresizingMaskIntoConstraints = false
        topFill.backgroundColor = Self.sky
        topFill.layer.shadowColor = Self.sky.cgColor
        topFill.layer.shadowOpacity = 0.85
        topFill.layer.shadowRadius = 6
        topFill.layer.shadowOffset = .zero
        topTrack.addSubview(topFill)
        let width = topFill.widthAnchor.constraint(equalToConstant: 0)
        topFillWidth = width
        let leading = topFill.leadingAnchor.constraint(equalTo: topTrack.leadingAnchor)
        leading.priority = .defaultHigh

        NSLayoutConstraint.activate([
            topTrack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topTrack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topTrack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topTrack.heightAnchor.constraint(equalToConstant: 3),
            topFill.topAnchor.constraint(equalTo: topTrack.topAnchor),
            topFill.bottomAnchor.constraint(equalTo: topTrack.bottomAnchor),
            leading,
            width,
        ])
    }

    /// iPhone zooms the whole page when a text field is tapped. Keep the site at its normal size.
    private func lockPageScale(_ webView: WKWebView) {
        let scroll = webView.scrollView
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 1
        scroll.bouncesZoom = false
        scroll.pinchGestureRecognizer?.isEnabled = false
        if scroll.zoomScale != 1 { scroll.setZoomScale(1, animated: false) }
        for gesture in scroll.gestureRecognizers ?? [] {
            guard let tap = gesture as? UITapGestureRecognizer, tap.numberOfTapsRequired == 2 else { continue }
            tap.isEnabled = false
        }
        guard !didInstallZoomLock else { return }
        didInstallZoomLock = true
        let script = WKUserScript(source: Self.noFocusZoomScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
        zoomObservation = scroll.observe(\.zoomScale, options: [.new]) { scroll, _ in
            guard scroll.zoomScale != 1 else { return }
            scroll.setZoomScale(1, animated: false)
        }
        keepFieldFocusFromZooming(webView)
    }

    private func keepFieldFocusFromZooming(_ webView: WKWebView) {
        webView.evaluateJavaScript(Self.noFocusZoomScript, completionHandler: nil)
    }

    private static let noFocusZoomScript = """
    (function() {
      var content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
      var head = document.head || document.documentElement;
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        head.appendChild(meta);
      }
      if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
      if (!document.getElementById('entilaka-no-focus-zoom')) {
        var style = document.createElement('style');
        style.id = 'entilaka-no-focus-zoom';
        style.textContent = 'input, textarea, select { font-size: 16px !important; }';
        head.appendChild(style);
      }
    })();
    """

    private var usesRightToLeft: Bool {
        let language = Locale.preferredLanguages.first ?? ""
        return language.hasPrefix("ar") || language.hasPrefix("he")
    }

    private func apply(progress: Double, loading: Bool) {
        let amount = CGFloat(min(max(progress, 0), 1))
        if !hasFinishedFirstLoad {
            launchFillWidth?.constant = max(18, 112 * amount)
            if amount > 0.98 && !loading {
                hasFinishedFirstLoad = true
                fadeOut(launchOverlay)
            }
            return
        }
        guard loading || amount < 0.98 else {
            topFillWidth?.constant = view.bounds.width
            fadeOut(topTrack)
            return
        }
        topTrack.isHidden = false
        topTrack.alpha = 1
        view.bringSubviewToFront(topTrack)
        topFillWidth?.constant = max(12, view.bounds.width * amount)
    }

    private func fadeOut(_ target: UIView) {
        UIView.animate(withDuration: 0.28, delay: 0.05, options: [.curveEaseOut]) {
            target.alpha = 0
        } completion: { _ in
            target.isHidden = true
            target.alpha = 1
        }
    }

    private static let navy = UIColor(red: 15 / 255, green: 23 / 255, blue: 42 / 255, alpha: 1)
    private static let sky = UIColor(red: 56 / 255, green: 189 / 255, blue: 248 / 255, alpha: 1)
}
