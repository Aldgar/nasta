import { io, Socket } from "socket.io-client";
import { getApiBase } from "../lib/api";

class SocketService {
  private socket: Socket | null = null;
  private getTrackingUrl() {
    const base = getApiBase().replace(/\/$/, "");
    return `${base}/tracking`;
  }

  connect() {
    if (this.socket) return this.socket;

    this.socket = io(this.getTrackingUrl(), {
      transports: ["websocket"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    this.socket.on("connect_error", (err) => {
      console.log("Socket connection error:", err);
    });

    return this.socket;
  }

  joinBooking(bookingId: string) {
    if (!this.socket) this.connect();
    this.socket?.emit("joinBooking", { bookingId });
  }

  updateLocation(data: {
    bookingId: string;
    lat: number;
    lng: number;
    heading?: number;
  }) {
    if (!this.socket) this.connect();
    this.socket?.emit("updateLocation", data);
  }

  private locationUpdateCallback: ((data: any) => void) | null = null;

  onLocationUpdate(
    callback: (data: {
      lat: number;
      lng: number;
      heading?: number;
      providerId: string;
    }) => void
  ) {
    if (!this.socket) this.connect();

    // Remove previous listener if exists
    if (this.locationUpdateCallback && this.socket) {
      this.socket.off("locationUpdate", this.locationUpdateCallback);
    }

    // Set new callback and register listener
    this.locationUpdateCallback = callback;
    this.socket?.on("locationUpdate", callback);
  }

  removeLocationUpdateListener() {
    if (this.socket && this.locationUpdateCallback) {
      this.socket.off("locationUpdate", this.locationUpdateCallback);
      this.locationUpdateCallback = null;
    }
  }

  disconnect() {
    // Remove listeners before disconnecting
    this.removeLocationUpdateListener();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
