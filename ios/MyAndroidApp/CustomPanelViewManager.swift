import UIKit
import React

@objc(CustomPanelManager)
class CustomPanelManager: RCTViewManager {
  override func view() -> UIView! {
    let container = CustomGradientView()
    
    // Title label
    let titleLabel = UILabel()
    titleLabel.text = "Native iOS UIView Panel"
    titleLabel.textColor = .white
    titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .bold)
    titleLabel.textAlignment = .center
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(titleLabel)
    
    // Status label
    let statusLabel = UILabel()
    statusLabel.tag = 101 // Tag to retrieve and update the label later
    statusLabel.text = "Engine State: Initialized"
    statusLabel.textColor = UIColor(red: 0.0, green: 0.9, blue: 0.46, alpha: 1.0) // Vibrant premium green
    statusLabel.font = UIFont.systemFont(ofSize: 14)
    statusLabel.textAlignment = .center
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(statusLabel)
    
    // Constraints
    NSLayoutConstraint.activate([
      titleLabel.centerXAnchor.constraint(equalTo: container.centerXAnchor),
      titleLabel.centerYAnchor.constraint(equalTo: container.centerYAnchor, constant: -15),
      
      statusLabel.centerXAnchor.constraint(equalTo: container.centerXAnchor),
      statusLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 10)
    ])
    
    return container
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Custom view that handles updating the gradient layer bounds on layout changes
class CustomGradientView: UIView {
  private let gradient = CAGradientLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupGradient()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupGradient()
  }

  private func setupGradient() {
    gradient.colors = [
      UIColor(red: 0.05, green: 0.12, blue: 0.15, alpha: 1.0).cgColor, // #0F2027
      UIColor(red: 0.12, green: 0.22, blue: 0.26, alpha: 1.0).cgColor, // #203A43
      UIColor(red: 0.17, green: 0.32, blue: 0.39, alpha: 1.0).cgColor  // #2C5364
    ]
    gradient.locations = [0.0, 0.5, 1.0]
    gradient.startPoint = CGPoint(x: 0.0, y: 0.0)
    gradient.endPoint = CGPoint(x: 1.0, y: 1.0)
    gradient.cornerRadius = 24
    layer.insertSublayer(gradient, at: 0)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    gradient.frame = bounds
  }
}

// Extension to update properties from JS
extension UIView {
  @objc func setStatusText(_ statusText: NSString) {
    if let statusLabel = self.viewWithTag(101) as? UILabel {
      statusLabel.text = statusText as String
    }
  }
}
