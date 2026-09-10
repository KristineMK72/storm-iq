import CarPlay
import UIKit

/// Phase 3 sketch — only works after Apple grants a CarPlay entitlement
/// and you wire a CarPlay scene into Info.plist.
///
/// This builds a simple list of threat categories. Live data should be
/// fetched from the same NWS endpoints the web app uses.
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    var interfaceController: CPInterfaceController?

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController

        let tor = CPListItem(text: "Tornado warnings", detailText: "Open phone for map")
        let svr = CPListItem(text: "Severe thunderstorm", detailText: "Open phone for map")
        let ffw = CPListItem(text: "Flash flood warnings", detailText: "Open phone for map")
        let safety = CPListItem(
            text: "Safety first",
            detailText: "NWS warnings always override Storm IQ"
        )

        let section = CPListSection(items: [tor, svr, ffw, safety])
        let list = CPListTemplate(title: "Storm IQ", sections: [section])
        interfaceController.setRootTemplate(list, animated: true, completion: nil)
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = nil
    }
}
