import React from 'react';
import { FaMapMarkedAlt } from 'react-icons/fa';

interface MultiDestinationMapLinkProps {
  locations: string[];
}

export const MultiDestinationMapLink: React.FC<MultiDestinationMapLinkProps> = ({ locations }) => {
  if (locations.length === 0) {
    return null;
  }

  const generateLink = () => {
    if (locations.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${locations[0]}`;
    }

    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1, -1).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    return url;
  };

  return (
    <a
      href={generateLink()}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-orange-700 hover:underline"
    >
      <FaMapMarkedAlt />
      <span>View day's route on Google Maps</span>
    </a>
  );
};
