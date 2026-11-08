import { groupMapMarkers } from './clusterMarkers';

test('clusters nearby pins only at wider zoom and drops invalid coordinates', () => {
  const marker = (id: string, latitude: number, longitude = 50.06) => ({
    id,
    coordinate: { latitude, longitude },
    color: '#000000',
    title: id,
  });
  const markers = [marker('a', 26.2501), marker('b', 26.2502), marker('far', 26.27), marker('bad', 93)];
  expect(groupMapMarkers(markers, 0.05, 0.05).map(({ markers }) => markers.map(({ id }) => id))).toEqual([['a', 'b'], ['far']]);
  expect(groupMapMarkers(markers, 0.001, 0.001).map(({ markers }) => markers.map(({ id }) => id))).toEqual([['a'], ['b'], ['far']]);
});
