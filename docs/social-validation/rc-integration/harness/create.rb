require 'xcodeproj'
project = Xcodeproj::Project.new('RcWalkthrough.xcodeproj')
target = project.new_target(:ui_test_bundle, 'RcWalkthrough', :ios, '17.0')
target.build_configurations.each do |config|
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'sa.haratna.app.socialdev.rcwalkthrough'
  config.build_settings['SWIFT_VERSION'] = '5.0'
end
%w[RcCases.swift RcFixture.swift].each { |f| target.source_build_phase.add_file_reference(project.main_group.new_file(f)) }
project.save
scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(target, target, launch_target: false)
scheme.save_as(project.path, 'RcWalkthrough', true)
