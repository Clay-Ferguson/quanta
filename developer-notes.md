# Notes

## WebRTC Implementation Options

This app has the ability to use both plain browser-provided WebRTC (without the `simple-peer` or `webrtc-adapter`), as well as the newer simple-peer approach. By default, both `WebRTCSigServer.ts` and `WebRTC.ts` files are used and they're the `simple-peer` versions, which assume simple-peer is in use. 

However you'll also find a `WebRTCSigServer_Legacy.ts` and `WebRTC_Legacy.ts` files which are available in the code right beside their non-Legacy versions. The "legacy" files are the "pure WebRTC" ones (i.e. no simple-peer). If you ever want to remove `simple-peer` as a dependency, and stop using `simple-peer` then all you'd have to do is 1) set the two `useLegacyWebRTC` variables to true, and 2) optionally, remove the yarn packages `simple-peer` and `webrtc-adapter`. In other words, if you want to actually switch back and forth between a `simple-peer` implementation and a non-`simple-peer` implementation all you need to do is set those variables, and rebuild.

*I'm probably being paranoid to maintain the ability to egress back from `simple-peer`, because it's well established and should be solid to use forever, but since it was easy to maintain this egress path simply by keeping the old Legacy code in place, that's what I'm doing for now. Feel free do delete the Legacy files if you're all-in on `simple-peer`!