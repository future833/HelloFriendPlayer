/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from '@microsoft/mixed-reality-extension-sdk'


/** Defines an animation control field */
interface ControlDefinition {
	/** Decorative label for the control */
	label: string
	/** Changes a property, and returns a result string */
	action: (incr: number) => string
	/** Whether the control should be updated on a timer */
	realtime?: boolean
	/** The actor who's text needs to be updated */
	labelActor?: MRE.Actor
}


export default class StreamingAV {
	expectedResultDescription = "livestreams video"

    private assets: MRE.AssetContainer
    parentActor: MRE.Actor
    videoStreams: MRE.VideoStream[]
    videoStream: MRE.VideoStream
    currentInstance: MRE.MediaInstance
    currentStream = 0
    isPlaying = true
    
    volume = 0.1
    looping = true
    spread = 0.8
	rolloffStartDistance = 2.5

	controls: ControlDefinition[] = []

    
    /**
     * create an instance
     * @param context 
     * @param baseUrl 
     */
    constructor(private context: MRE.Context, private baseUrl: string){

    }


	public cleanup() {
		this.assets.unload()
	}



    /**
     * make streaming happen
     * @param rootActor 
     */
	public async run(rootActor: MRE.Actor): Promise<boolean> {

		this.assets = new MRE.AssetContainer(this.context)

		this.parentActor = MRE.Actor.Create(this.context, {
			actor: {
				parentId: rootActor.id,
				name: 'video',
				transform: {
					local: {
						position: { x: 1, y: -1, z: -4 },
						scale: { x: 1, y: 1, z: 1 }
					}
                },
                grabbable: true,
			}
		})

		
        //set up the new stream
        this.videoStream = this.assets.createVideoStream(
			'avStream',
			{
				uri: 'youtube://5yx6BWlEVcY'
				// uri: 'youtube://9RTaIpVuTqE'
				// uri: `youtube://U03lLvhBzOw`
				// uri: `youtube://kK42LZqO0wA`
				// uri: `youtube://MejbOFk7H6c`
				// uri: `https://dl.dropbox.com/s/ufneqctlgqhmpmo/Space-Unicorn-Parry-Gripp-and-Br%20%281%29.mp4?dl=1`
				
			}
		)

        //wait for the actor to actually be created on the client
		await Promise.all([this.parentActor.created()])

        //if a streaming instance is already going stop it before continuing
        if (this.currentInstance) this.currentInstance.stop()
        
        //start the new video stream
		this.currentInstance = this.parentActor.startVideoStream(
			this.videoStream.id,
			{
				volume: this.volume,
				looping: this.looping,
				spread: this.spread,
				rolloffStartDistance: this.rolloffStartDistance
            }
        )


        //define controls for the stream
        //each of these controls will have up/dn adjustment buttons
		this.controls = [
			{
				label: "Playing", realtime: true, action: incr => {
					if (incr !== 0) {
						if (!this.isPlaying) {
							this.currentInstance.resume()
							this.isPlaying = true
						} else {
							this.currentInstance.pause()
							this.isPlaying = false
						}
					}
					return this.isPlaying.toString()
				}
			},
			{
				label: "Volume", action: incr => {
					if (incr > 0) {
						this.volume = this.volume >= 1.0 ? 1.0 : this.volume + .1
					} else if (incr < 0) {
						this.volume = this.volume <= 0.0 ? 0.0 : this.volume - .1
					}
					this.currentInstance.setState({ volume: this.volume })
					return Math.floor(this.volume * 100) + "%"
				}
			},
			{
				label: "Spread", action: incr => {
					if (incr > 0) {
						this.spread = this.spread >= 1.0 ? 1.0 : this.spread + .1
					} else if (incr < 0) {
						this.spread = this.spread <= 0.0 ? 0.0 : this.spread - .1
					}
					this.currentInstance.setState({ spread: this.spread })
					return Math.floor(this.spread * 100) + "%"
				}
			},
			{
				label: "Rolloff", action: incr => {
					if (incr > 0) {
						this.rolloffStartDistance += .1
					} else if (incr < 0) {
						this.rolloffStartDistance -= .1
                    }
					this.currentInstance.setState({ rolloffStartDistance: this.rolloffStartDistance })
					return this.rolloffStartDistance.toString()
				}
			},
        ]
        
        //the controls are defined now we have to create them
		this.createControls(this.controls, MRE.Actor.Create(this.context, {
			actor: {
				name: 'controlsParent',
				parentId: rootActor.id,
				transform: { local: { position: { x: 0.6, y: 1, z: -1 } } }
			}
		}))

		return true
	}

    /**
     * loops through an array of controls adding up/dn buttons for each
     * @param controls 
     * @param parent 
     */
	private createControls(controls: ControlDefinition[], parent: MRE.Actor) {
		const arrowMesh = this.assets.createCylinderMesh('arrow', 0.01, 0.08, 'z', 3)
		const layout = new MRE.PlanarGridLayout(parent)

		let i = 0

		for (const controlDef of controls) {
			let label: MRE.Actor, more: MRE.Actor, less: MRE.Actor
			layout.addCell({
				row: i,
				column: 1,
				width: 0.3,
				height: 0.25,
				contents: label = MRE.Actor.Create(this.context, {
					actor: {
						name: `${controlDef.label}-label`,
						parentId: parent.id,
						text: {
							contents: `${controlDef.label}:\n${controlDef.action(0)}`,
							height: 0.1,
							anchor: MRE.TextAnchorLocation.MiddleCenter,
							justify: MRE.TextJustify.Center,
							color: MRE.Color3.FromInts(255, 200, 255)
						}
					}
				})
			})
			controlDef.labelActor = label

			layout.addCell({
				row: i,
				column: 0,
				width: 0.3,
				height: 0.25,
				contents: less = MRE.Actor.Create(this.context, {
					actor: {
						name: `${controlDef.label}-less`,
						parentId: parent.id,
						appearance: { meshId: arrowMesh.id },
						collider: { geometry: { shape: MRE.ColliderType.Auto } },
						transform: { local: { rotation: MRE.Quaternion.FromEulerAngles(0, 0, Math.PI * 1.5) } }
					}
				})
			})

			layout.addCell({
				row: i,
				column: 2,
				width: 0.3,
				height: 0.25,
				contents: more = MRE.Actor.Create(this.context, {
					actor: {
						name: `${controlDef.label}-more`,
						parentId: parent.id,
						appearance: { meshId: arrowMesh.id },
						collider: { geometry: { shape: MRE.ColliderType.Auto } },
						transform: { local: { rotation: MRE.Quaternion.FromEulerAngles(0, 0, Math.PI * 0.5) } }
					}
				})
			})

			less.setBehavior(MRE.ButtonBehavior).onButton("pressed", () => {
				controlDef.labelActor.text.contents = `${controlDef.label}:\n${controlDef.action(-1)}`
			})

			more.setBehavior(MRE.ButtonBehavior).onButton("pressed", () => {
				controlDef.labelActor.text.contents = `${controlDef.label}:\n${controlDef.action(1)}`
			})

			i++
		}

		layout.applyLayout()

	}

	/**
	 * spawn controls on the users wrist
	 * @param user 
	 */
	createUserControls(user: MRE.User) {

		//create the wrist menu button meshes
		const arrowMesh1 = this.assets.createCylinderMesh('arrow', 0.01, 0.08, 'z', 3)
		const arrowMesh2 = this.assets.createCylinderMesh('arrow', 0.01, 0.08, 'z', 3)
		//wrist menu root pose
		const root = {pos:{x:0, y:0, z:0.04}, ori:{x:2.325398, y:1.570796, z:0}}

		const volumeUpButton = MRE.Actor.Create(this.context, {
			actor: {
				appearance: { meshId: arrowMesh1.id },
				collider: { geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: {
						position: { x: root.pos.x + -0.05, y: root.pos.y + 0.05, z: root.pos.z + -0.075 },
						rotation: MRE.Quaternion.FromEulerAngles(root.ori.x, root.ori.y, 0),
						scale: { x: 0.3, y: 0.3, z: 0.5 },
					}
				},
				attachment: {
					attachPoint: "left-hand",
					userId: user.id
				}
			}
		})

		const volumeDnButton = MRE.Actor.Create(this.context, {
			actor: {
				appearance: { meshId: arrowMesh2.id },
				collider: { geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: {
						position: { x: root.pos.x + -0.05, y: root.pos.y + 0.05, z: root.pos.z + -0.04 },
						rotation: MRE.Quaternion.FromEulerAngles(root.ori.x, root.ori.y, 1),
						scale: { x: 0.3, y: 0.3, z: 0.5 },
					}
				},
				attachment: {
					attachPoint: "left-hand",
					userId: user.id
				}
			}
		})

		const volumeUpButtonBehavior = volumeUpButton.setBehavior(MRE.ButtonBehavior)
		volumeUpButtonBehavior.onButton("pressed", this.volumeUp)

		const volumeDnButtonBehavior = volumeDnButton.setBehavior(MRE.ButtonBehavior)
		volumeDnButtonBehavior.onButton("pressed", this.volumeDn)

	}


	/**
	 * volume up contol
	 */
	volumeUp = () => {
		//use the control defined in the contol definition
		this.controls[1].labelActor.text.contents = `${this.controls[1].label}:\n${this.controls[1].action(1)}`
	}

	/**
	 * volume dn contol
	 */
	volumeDn = () => {
		//use the control defined in the contol definition
		this.controls[1].labelActor.text.contents = `${this.controls[1].label}:\n${this.controls[1].action(-1)}`
	}


}