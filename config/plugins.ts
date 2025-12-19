export default ({ env }) => ({
	upload: {
		config: {
			provider: '@strapi/provider-upload-cloudinary',
			providerOptions: {
				cloud_name: env('CLOUDINARY_NAME'),
				api_key: env('CLOUDINARY_KEY'),
				api_secret: env('CLOUDINARY_SECRET'),
				folder: env('CLOUDINARY_FOLDER', 'engrave'),
			},
			actionOptions: {
				upload: {},
				uploadStream: {},
				delete: {},
			},
		},
	},
});
