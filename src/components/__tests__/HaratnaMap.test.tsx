import { fireEvent, render } from '@testing-library/react-native';

import { HaratnaMap } from '../HaratnaMap';

const mockAnimateToRegion = jest.fn();

jest.mock('react-native-maps', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(function MockMap(props: import('react-native-maps').MapViewProps, ref) {
      React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
      return <View {...props} testID="native-map" />;
    }),
    Marker: (props: import('react-native-maps').MapMarkerProps) => <View {...props} testID="native-marker" />,
    Polygon: (props: import('react-native-maps').MapPolygonProps) => <View {...props} testID="native-boundary" />,
  };
});

const center = { latitude: 26.2501, longitude: 50.061 };
const neighbor = { latitude: 26.2502, longitude: 50.061 };
const boundary = [center, neighbor, { latitude: 26.25, longitude: 50.062 }];
const markers = [
  { id: 'a', title: 'Business A', coordinate: center, color: '#000000' },
  { id: 'b', title: 'Business B', coordinate: neighbor, color: '#000000' },
];

test('uses the default native provider and passes through the neighborhood boundary', async () => {
  const map = await render(<HaratnaMap center={center} markers={markers} polygons={[boundary]} />);

  expect(map.getByTestId('native-map').props.provider).toBeUndefined();
  expect(map.getByTestId('native-boundary').props.coordinates).toEqual(boundary);
});

test('zooms on a cluster tap and opens individual markers after zooming in', async () => {
  const onMarkerPress = jest.fn();
  const map = await render(
    <HaratnaMap center={center} delta={0.05} markers={markers} clusterMarkers onMarkerPress={onMarkerPress} />,
  );
  const event = { stopPropagation: jest.fn() };
  const cluster = map.getByTestId('native-marker');
  expect(cluster.props.title).toBe('2');

  await fireEvent.press(cluster, event);
  expect(mockAnimateToRegion).toHaveBeenCalledWith(
    expect.objectContaining({ latitudeDelta: 0.05 / 3, longitudeDelta: 0.05 / 3 }),
    350,
  );
  expect(onMarkerPress).not.toHaveBeenCalled();

  await fireEvent(map.getByTestId('native-map'), 'regionChangeComplete', {
    ...center,
    latitudeDelta: 0.001,
    longitudeDelta: 0.001,
  });
  const pins = map.getAllByTestId('native-marker');
  expect(pins.map((pin) => pin.props.identifier)).toEqual(['a', 'b']);
  await fireEvent.press(pins[0], event);
  expect(onMarkerPress).toHaveBeenCalledWith('a');
});
